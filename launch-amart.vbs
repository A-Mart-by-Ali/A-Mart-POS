Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

' Launch desktop-server.js in complete stealth (0 = SW_HIDE, no command prompt window)
WshShell.Run "node desktop-server.js", 0, False
