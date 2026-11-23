Option Explicit
Dim shell, fso, projectDir, nodeCmd, serverJs, chromePath, edgePath, url, i

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
nodeCmd = "C:\Users\user\AppData\Roaming\Antigravity\bin\agy-node.cmd"
serverJs = projectDir & "\jarvis_server.js"
url = "http://localhost:8080/jarvis.html"

Function IsServerAlive()
    On Error Resume Next
    Dim http
    Set http = CreateObject("MSXML2.XMLHTTP.6.0")
    http.Open "GET", "http://localhost:8080/health", False
    http.Send
    If Err.Number = 0 And http.Status = 200 Then
        IsServerAlive = True
    Else
        IsServerAlive = False
    End If
    On Error GoTo 0
End Function

If Not IsServerAlive() Then
    shell.CurrentDirectory = projectDir
    shell.Run "cmd /c """"" & nodeCmd & """ """ & serverJs & """""", 0, False
    For i = 1 To 20
        WScript.Sleep 250
        If IsServerAlive() Then Exit For
    Next
End If

chromePath = shell.ExpandEnvironmentStrings("%ProgramFiles%\Google\Chrome\Application\chrome.exe")
edgePath = shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe")

If fso.FileExists(chromePath) Then
    shell.Run """" & chromePath & """ --app=" & url, 1, False
ElseIf fso.FileExists(edgePath) Then
    shell.Run """" & edgePath & """ --app=" & url, 1, False
Else
    shell.Run url, 1, False
End If
