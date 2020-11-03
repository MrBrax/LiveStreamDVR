import json
import sys

input_path = sys.argv[1]
output_path = input_path + ".txt"
dateformat = "%Y-%m-%dT%H:%M:%S.%fZ"
raw_text = ""

outfile = open(output_path, 'a', encoding='utf-8')

with open(input_path, 'r', encoding='utf-8') as infile:
    print("Loading JSON")
    data = json.load(infile)
    print("Loaded JSON")
    for comment in data['comments']:
        body_text = comment['message']['body']
        try:
            outfile.write( "<{date}> {user}: {message}\n".format( date=comment['created_at'], user=comment['commenter']['display_name'], message=body_text ) )
        except:
            print( "Text error", body_text )
        
        # try:
        #     print( "<{date}> {user}: {message}\n".format( date=comment['created_at'], user=comment['commenter']['display_name'], message=comment['message']['body'] ) )
        # except:
        #     print("Print error")
        


outfile.close()

# with open(output_path, 'w') as outfile:
#    outfile.write( raw_text )