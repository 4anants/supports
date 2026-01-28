; IT Supports Inno Setup Script

#define MyAppName "IT Supports"
#define MyAppVersion "1.0"
#define MyAppPublisher "IT Supports"
#define MyAppExeName "release_runner.cjs"

[Setup]
AppId={{D3E4B7C9-1E2F-4A4B-9D1E-C6D2D8F63E4A}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={pf}\{#MyAppName}
DisableProgramGroupPage=yes
DisableDirPage=yes
DisableWelcomePage=yes
DisableReadyPage=yes
DisableFinishedPage=yes
PrivilegesRequired=admin
OutputBaseFilename=ITSupportsSetup
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "release_staging\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Run]
; Stop existing service if it exists (ignore failure)
Filename: "{sys}\net.exe"; Parameters: "stop ""IT Supports"""; Flags: runhidden waituntilterminated

; Add Firewall Rule for Port 3001
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""IT Supports"" dir=in action=allow protocol=TCP localport=3001"; Flags: runhidden waituntilterminated

; Install and Start the Service automatically
Filename: "{app}\maintenance\silent_install.bat"; WorkingDir: "{app}"; Flags: runhidden waituntilterminated

; Open browser to the app
Filename: "http://localhost:3001"; Flags: shellexec runasoriginaluser

[UninstallRun]
; Stop and Remove Service
Filename: "{app}\node.exe"; Parameters: "maintenance\uninstall_service.cjs"; Flags: runhidden

; Remove Firewall Rule
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""IT Supports"""; Flags: runhidden
