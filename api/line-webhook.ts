name: Daily Ranking Reminder

on:
  schedule:
    - cron: '0 5 * * *'   # 14:00 JST
    - cron: '0 8 * * *'   # 17:00 JST
    - cron: '0 11 * * *'  # 20:00 JST
  workflow_dispatch:  # 手動実行も可能

jobs:
  send-ranking:
    runs-on: ubuntu-latest
    steps:
      - name: Send ranking to goal-setting members
        env:
          LINE_ACCESS_TOKEN: ${{ secrets.LINE_CHANNEL_ACCESS_TOKEN }}
          FIREBASE_SERVICE_ACCOUNT_KEY: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_KEY }}
        run: |
          node << 'EOF'
          const https = require('https');
          const crypto = require('crypto');

          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          const projectId = serviceAccount.project_id;

          async function getAccessToken() {
            const now = Math.floor(Date.now() / 1000);
            const header = Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})).toString('base64url');
            const payload = Buffer.from(JSON.stringify({
              iss: serviceAccount.client_email,
              scope: 'https://www.googleapis.com/auth/datastore',
              aud: 'https://oauth2.googleapis.com/token',
              exp: now + 3600,
              iat: now
            })).toString('base64url');
            const sign = crypto.createSign('RSA-SHA256');
            sign.update(`${header}.${payload}`);
            const sig = sign.sign(serviceAccount.private_key, 'base64url');
            const jwt = `${header}.${payload}.${sig}`;
            return new Promise((resolve, reject) => {
              const data = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
              const req = https.request({
                hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
                headers: {'Content-Type':'application/x-www-form-urlencoded','Content-Length':data.length}
              }, res => {
                let body = '';
                res.on('data', d => body += d);
                res.on('end', () => resolve(JSON.parse(body).access_token));
              });
              req.on('error', reject);
              req.write(data); req.end();
            });
          }

          async function firestoreGet(token, path) {
            return new Promise((resolve, reject) => {
              const req = https.request({
                hostname: 'firestore.googleapis.com', path, method: 'GET',
                headers: {'Authorization': `Bearer ${token}`}
              }, res => {
                let body = '';
                res.on('data', d => body += d);
                res.on('end', () => resolve(JSON.parse(body)));
              });
              req.on('error', reject);
              req.end();
            });
          }

          async function sendLineMessage(lineUserId, message) {
            return new Promise((resolve) => {
              const body = JSON.stringify({
                to: lineUserId,
                messages: [{type: 'text', text: message}]
              });
              const req = https.request({
                hostname: 'api.line.me', path: '/v2/bot/message/push', method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${process.env.LINE_ACCESS_TOKEN}`,
                  'Content-Length': Buffer.byteLength(body)
                }
              }, res => {
                let resBody = '';
                res.on('data', d => resBody += d);
                res.on('end', () => {
                  console.log(`Sent to ${lineUserId}: ${res.statusCode}`);
                  resolve();
                });
              });
              req.on('error', resolve);
              req.write(body); req.end();
            });
          }

          async function main() {
            // JSTで今日の日付を取得
            const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
            const date = jstNow.toISOString().slice(0,10);
            const hours = jstNow.getUTCHours();
            console.log(`Running for date: ${date}, JST hour: ${hours}`);

            const FIELD_LABELS = {
              newContract:'新規', deviceChange:'機変', mnpIn:'MNP転入',
              portIn:'番号移行', netLine:'ネット', creditCard:'クレカ', energy:'電気/ガス'
            };

            const token = await getAccessToken();

            // 今日の目標を持つユーザーを取得
            const goalsData = await firestoreGet(token,
              `/v1/projects/${projectId}/databases/(default)/documents:runQuery`
            );

            // goalsコレクションから今日の目標を取得
            const goalUsersData = await firestoreGet(token,
              `/v1/projects/${projectId}/databases/(default)/documents/goals?pageSize=100`
            );

            const goalUsers = (goalUsersData.documents || []).map(d => d.name.split('/').pop());
            console.log(`Goal users: ${goalUsers.length}`);

            if (goalUsers.length === 0) {
              console.log('No users with goals today, skipping.');
              return;
            }

            // 各ユーザーの今日の目標と実績を取得してランキング作成
            const results = [];
            for (const uid of goalUsers) {
              // 目標取得
              let goalTotal = 0; let goalName = '';
              try {
                const gData = await firestoreGet(token,
                  `/v1/projects/${projectId}/databases/(default)/documents/goals/${uid}/daily/${date}`
                );
                if (gData.fields) {
                  goalName = gData.fields.displayName?.stringValue || '';
                  const goals = gData.fields.goals?.mapValue?.fields || {};
                  goalTotal = Object.values(goals).reduce((s, v) => s + (v.integerValue || v.doubleValue || 0), 0);
                }
              } catch(e) { continue; }
              if (goalTotal === 0) continue;

              // 実績取得
              let actual = 0;
              try {
                const rData = await firestoreGet(token,
                  `/v1/projects/${projectId}/databases/(default)/documents/salesReports/${uid}/daily/${date}`
                );
                if (rData.fields) {
                  const entries = rData.fields.entries?.arrayValue?.values || [];
                  const fields = ['newContract','deviceChange','mnpIn','portIn','netLine','creditCard','energy'];
                  actual = entries.reduce((s, e) => {
                    const ef = e.mapValue?.fields || {};
                    return s + fields.reduce((s2, k) => s2 + (ef[k]?.integerValue || ef[k]?.doubleValue || 0), 0);
                  }, 0);
                }
              } catch(e) {}

              const rate = Math.round((actual / goalTotal) * 100);
              const remaining = Math.max(0, goalTotal - actual);
              results.push({uid, name: goalName, actual, goalTotal, rate, remaining});
            }

            results.sort((a, b) => b.rate - a.rate);

            if (results.length === 0) {
              console.log('No results to send.');
              return;
            }

            const medals = ['🥇','🥈','🥉'];
            const lines = results.map((r, i) => {
              const medal = medals[i] || `${i+1}位`;
              return `${medal} ${r.name}\n　達成率：${r.rate}%（${r.actual}/${r.goalTotal}件）\n　残り：${r.remaining}件`;
            }).join('\n\n');

            const message = `【${date} ${hours}:00 ランキング】\n\n${lines}`;

            // lineUsersから全LINE User IDを取得
            const lineUsersData = await firestoreGet(token,
              `/v1/projects/${projectId}/databases/(default)/documents/lineUsers?pageSize=100`
            );
            const lineUserDocs = lineUsersData.documents || [];

            // 目標設定者のLINE IDのみ抽出して送信
            const goalUidSet = new Set(goalUsers);
            const targetLineUsers = lineUserDocs.filter(d => {
              const uid = d.fields?.uid?.stringValue;
              return uid && goalUidSet.has(uid);
            });

            console.log(`Sending to ${targetLineUsers.length} users`);
            for (const doc of targetLineUsers) {
              const lineUserId = doc.name.split('/').pop();
              await sendLineMessage(lineUserId, message);
              await new Promise(r => setTimeout(r, 500));
            }
            console.log('Done!');
          }

          main().catch(console.error);
          EOF
