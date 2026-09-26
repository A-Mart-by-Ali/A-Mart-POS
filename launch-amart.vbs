Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

' Launch run-pos.bat in complete stealth (0 = SW_HIDE, zero console window)
WshShell.Run "cmd.exe /c """ & scriptDir & "\run-pos.bat""", 0, False
