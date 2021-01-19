import json
import os
#import zipfile
from shutil import copy2

with open("package.json") as f:
    data = json.load(f)
    zipname = data['name'] + "-" + data['version'] + ".zip"
    os.system("cd client-vue && yarn build")
    os.system("xcopy /E /Y .\\client-vue\\dist .\\public\\")
    os.system("git archive -o build/" + zipname + " HEAD")