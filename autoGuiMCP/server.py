from fastmcp import FastMCP
import pyautogui


mcp = FastMCP("AutoGUITools")



@mcp.tool
def move_cursor(x: int, y: int):
    """Moves the cursor to the coordinates (x, y) where the (0, 0) is at the top left.

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




def main():
    pyautogui.PAUSE = 1.0
    mcp.run(transport = "stdio")

if __name__ == "__main__":
    mcp.run(transport = "stdio")
