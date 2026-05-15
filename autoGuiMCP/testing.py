import fastmcp
import pyautogui


screenWidth, screenHeight = pyautogui.size()
print(screenHeight, screenWidth)

currentMouseX, currentMouseY = pyautogui.position()
print(currentMouseX, currentMouseY)

pyautogui.click(100, 150)

with pyautogui.hold('command'):
    pyautogui.press(['q', 'q', 'q', 'q'])
