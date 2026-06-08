from fastmcp import FastMCP
import pyautogui


mcp = FastMCP("AutoGUITools")


@mcp.tool
def move_cursor(x: int, y: int):
    """
    Moves the cursor to the coordinates (x, y) where the (0, 0) is at the top left.

    Args:
        x: the position of x coordinate of the pixel to move to.
        y: the position of y coordinate of the pixel to move to.

    None value can be passed to any coordinate if we do not want that coordinate of the cursor to move. 
    """
    try: 
        pyautogui.moveTo(x, y, 2, pyautogui.easeOutQuad)
        return {"status" : "The pointer has moved to the correct position as specified"}
    except Exception as e:
        print(f"The tool call for move_cursor() was unsuccessful, error: {e}")
        return {"status" : "The pointer has not moved to the specified position and has encountered an error."}


@mcp.tool
def get_size():
    """returns the current width and height of the screen in number of pixel values."""
    try:
        Width, Height = pyautogui.size()
        return {"status" : "Current width and height received",
                "dimensions" : {
                    "width" : Width,
                    "height" : Height
                }
        }
    except Exception as e:
        return {"status" : f"The tool call of getting size was unsuccessfull, error {e}"}


@mcp.tool
def get_current_position():
    """Get current position of the cursor (x, y), where x and y are measured as pixel numbers from top-left."""
    
    try:
        currentX, currentY = pyautogui.position()
        return {
                "status" : "received cursor position successfully",
                "position" : {
                    "current_x_position" : currentX,
                    "current_y_position" : currentY
                    }
                }
    except Exception as e:
        return {"status" : f"The cursor position failed to receive, error: {e}"}


@mcp.tool
def click(x: int, y: int, clicks: int, interval: float, button: str):
    """
    This tool is used to click on relevant positions given by x and y args

    Args:
        x: The x coordinate of the pixel which increases from left to right
        y: The y coordinate of the pixel which increases from top to bottom
        clicks: specifies the number of clicks to be made on the specified position with the given interval between them
        interval: The amount of time between clicks
        button: The mouse button to be clicked, can be either one of "right", "left" or "middle"
    """
    try: 
        pyautogui.click(x, y, clicks, interval, button)
        return {"status" : f"The button {button} click was successful"}
    except Exception as e:
        return {"status" : f"The button {button} click was unsuccessfull, error {e}"}


# @mcp.tool
# def 










## Alerts from pyautogui

@mcp.tool
def alert(text : str, title : str, button : str = "Ok"):
    """
    The Tool is used to send an alert message box to the user.

    Args:
        text : message of the MCP client to the user.
        title : title of the alert box.
        button : button for the user to press
    """
    try:
        ok = pyautogui.alert(text = text, title = title, button = button)
        return {
                "status" : "The alert message was successful.",
                "ok_received" : ok
                }
    except Exception as e:
        return {
                "status" : f"The alert message was unsuccessful to send, error {e} occurred."
                }


@mcp.tool
def confirm(text : str, title : str, buttons : list[str]):
    """
    The Tool is used to send a confirmation message box to the user.

    Args:
        text : message of the MCP client to the user.
        title : title of the confirm box.
        buttons : a python list of options presented to the user for accepting a message

    Ideally a list of strings should be given to the buttons argument
    """
    if not isinstance(buttons, list):
        buttons = list(buttons)

    try: 
        confirmObject = pyautogui.confirm(text, title, buttons)
        return {
                "status" : "The message was received",
                "message" : confirmObject
                }
    except Exception as e:
        return {
                "status" : "The message was not received, error {e} occurred"
                }
    


@mcp.tool
def prompt(text : str, title : str, default : str):
    """
    The Tool is used to prompt the user for input.

    Args:
        text : message of the MCP client to the user asking for user input.
        title : title of the prompt box.
        default : default input value for the user input prompt

    Default is generally None
    """
    try:
        prompt = pyautogui.prompt(text = text, title = title, default = default)
        return {
                "status" : "The prompt from the user was successfully received",
                "user_prompt" : prompt
                }
    except Exception as e:
        return {
                "status" : "The prompt from the user was not received successfully, error {e} occurred"
                }


@mcp.tool
def password(text : str, title : str, default : str, mask : str = "*"):
    """
    This Tool is used to ask the user to input a password

    Args:
        text : Message presented to the user generally asking for a value we wish to mask while the user is typing.
        title : Title of the password box presented
        default : default value of the password, can be an auto-generated password
        mask : The masking character to hide the user entering password characters
    """
    try:
        password = pyautogui.password(text = text, title = title, default = default, mask = mask)
        return {
                "status" : "The password was taken successfully from the user.",
                "password received" : password
                }

    except Exception as e:
        return {
                "status" : "The password was not received successfully from the user, error {e} occurred."
                }



## Not being used currently
# def main():
#     pyautogui.PAUSE = 1.0
#     pyautogui.FAILSAFE = True
#     mcp.run(transport = "stdio")

if __name__ == "__main__":
   mcp.run(transport = "stdio")
