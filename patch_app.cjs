const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('AuthProvider')) {
  code = code.replace(
    "import { PlayerProvider, usePlayer } from './context/PlayerContext';",
    "import { PlayerProvider, usePlayer } from './context/PlayerContext';\nimport { AuthProvider } from './context/AuthContext';"
  );
  
  code = code.replace(
    "    <PlayerProvider>\n      <AppContent />\n    </PlayerProvider>",
    "    <AuthProvider>\n      <PlayerProvider>\n        <AppContent />\n      </PlayerProvider>\n    </AuthProvider>"
  );
  
  fs.writeFileSync('src/App.tsx', code);
}
