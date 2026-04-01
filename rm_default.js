const fs = require('fs');

function processFile(file, isElectron) {
  let content = fs.readFileSync(file, 'utf8');

  // Remove state
  content = content.replace(
    /const \[defaultUsers, setDefaultUsers\] = useState<UserInfo\[\]>\(\[\]\);\n\s*/,
    ''
  );

  // Replace setDefaultUsers(initUsers) with setLotteryUsers
  if (isElectron) {
    content = content.replace(
      /setDefaultUsers\(initUsers\);/,
      'setLotteryUsers(initUsers);'
    );
  }

  // Remove setDefaultUsers(updateList)
  content = content.replace(
    /[\s]*\/?\/?\s*setDefaultUsers\(updateList\);\n/,
    '\n'
  );

  // Replace users prop
  content = content.replace(
    /users=\{\(lotteryUsers\.length > 0 \? lotteryUsers : defaultUsers\)\.map\(u => \(\{/,
    'users={lotteryUsers.map(u => ({'
  );

  fs.writeFileSync(file, content);
}

processFile('apps/screen-web/src/App.tsx', false);
processFile('apps/screen-electron/src/App.tsx', true);
