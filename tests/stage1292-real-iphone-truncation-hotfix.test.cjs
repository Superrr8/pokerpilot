'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'src/styles/stage1101-redesign.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'src/ui/dashboard.js'), 'utf8');
const daily = fs.readFileSync(path.join(root, 'src/ui/daily-challenge.js'), 'utf8');

function hotfixBlock() {
  const marker = '/* Stage 12.9.2 — Real iPhone truncation hotfix. */';
  const start = css.indexOf(marker);
  assert.notEqual(start, -1, 'missing Stage 12.9.2 hotfix block');
  return css.slice(start);
}

test('Dashboard renderers keep the affected strings complete in data', () => {
  assert.match(dashboard, /`Poker IQ \$\{homeProgress\.pokerIQ\.value\} · \$\{homeProgress\.pokerIQ\.detail\}`/);
  assert.match(dashboard, /title:\s*`Продолжить: \$\{subject\}`/);
  assert.match(dashboard, /description:\s*'Вернитесь к последнему открытому материалу без потери прогресса\.'/);
  assert.match(dashboard, /label:\s*'Тренировка'/);
  assert.match(dashboard, /label:\s*'Ввести раздачу'/);
  assert.match(daily, /setText\(documentRef, '#dailyChallengeHandLabel', status\.challenge\.title\)/);
  assert.match(daily, /`\$\{outcome\} · \+\$\{review\.xpAwarded\} XP`/);
  assert.match(daily, /`Серия раздачи дня: \$\{progressSnapshot\?\.currentStreak \|\| 0\}/);
  assert.match(daily, /`Решено: \$\{progressSnapshot\?\.completedCount \|\| 0\} · Точность:/);
});

test('real-iPhone breakpoint covers widths above the former 430px boundary', () => {
  const block = hotfixBlock();
  assert.match(block, /^\/\* Stage 12\.9\.2[^]*@media \(max-width: 480px\)/);
  for (const viewport of [{ width: 390, height: 844 }, { width: 430, height: 932 }]) {
    assert.ok(viewport.width <= 480, `${viewport.width}x${viewport.height} must use the hotfix`);
  }
});

test('Dashboard hotfix stylesheet URL is versioned past stale iPhone caches', () => {
  assert.match(html, /href="src\/styles\/stage1101-redesign\.css\?v=12\.9\.[23]"/);
});

test('actual top summary and Continue children override every truncation primitive', () => {
  const block = hotfixBlock();
  assert.match(block, /#homeStatus\s*\{[^}]*max-width:\s*100%[^}]*overflow:\s*visible[^}]*text-overflow:\s*clip[^}]*white-space:\s*normal/s);
  assert.match(block, /#dashboardNextTitle,[^}]*#dashboardNextDescription\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%/s);
  assert.match(block, /#dashboardNextTitle,[^}]*#dashboardNextDescription\s*\{[^}]*overflow:\s*visible[^}]*white-space:\s*normal[^}]*-webkit-line-clamp:\s*unset/s);
});

test('actual Daily Hand children wrap instead of inheriting ellipsis or clamp', () => {
  const block = hotfixBlock();
  for (const id of ['dailyChallengeSummary', 'dailyChallengeHandLabel', 'dailyChallengeResult', 'dailyChallengeStreak', 'dailyChallengeAccuracy']) {
    assert.match(block, new RegExp(`#${id}`));
  }
  assert.match(block, /#dailyChallengeSummary,[^}]*#dailyChallengeAccuracy\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%/s);
  assert.match(block, /#dailyChallengeSummary,[^}]*#dailyChallengeAccuracy\s*\{[^}]*overflow:\s*visible[^}]*text-overflow:\s*clip[^}]*white-space:\s*normal[^}]*-webkit-line-clamp:\s*unset/s);
  assert.match(block, /#dailyChallengeStreak,[^}]*#dailyChallengeAccuracy\s*\{[^}]*flex:\s*1 1 145px/s);
});

test('actual Quick Action label children stay fluid and naturally wrap', () => {
  const block = hotfixBlock();
  assert.match(block, /\.home-dashboard-pro \.home-quick-action,[^}]*\.home-dashboard-pro \.home-quick-action strong\s*\{[^}]*min-width:\s*0/s);
  assert.match(block, /\.home-dashboard-pro \.home-quick-action strong\s*\{[^}]*max-width:\s*100%[^}]*overflow:\s*visible[^}]*text-overflow:\s*clip[^}]*white-space:\s*normal[^}]*word-break:\s*normal/s);
});

test('hotfix remains Dashboard-only and does not alter fixed geometry or product state', () => {
  const block = hotfixBlock();
  assert.doesNotMatch(block, /#screen-live|live-v2|poker-table|player-pod|heroCards|liveActions|bottom-nav/);
  assert.doesNotMatch(block, /PokerCore|Trainer|evaluateHand|localStorage|data-theme/);
  assert.doesNotMatch(block, /position:\s*(?:absolute|fixed)|grid-template-areas|transform:/);
});
