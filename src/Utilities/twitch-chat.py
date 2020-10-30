import socket
import time
import datetime
from random import random
import re
import json
import signal
import sys
import select

# http://www.rikels.info/index.php/en/articles/55-enter-a-twich-chat-without-account

# twitch-chat.py CHANNEL USERID OUTPUT

Twitch_user = "justinfan{random}".format(random=int(random()*9999999))
Twitch_pass = "blah"
Twitch_channel = sys.argv[1]
Twitch_userid = sys.argv[2]
chat_log_path = "./"
sub = False
sub_time = None

num_to_save = 500
last_save = 0

output_path = sys.argv[3]

raw_text = ""

running = True

dateformat = "%Y-%m-%dT%H:%M:%SZ"

time_start = time.time()
date_start = datetime.datetime.utcnow().strftime(dateformat)

ls_cap = True

jsondata = {
    "comments": [],
    "video": {
        "created_at": date_start, # fake
        "description": "",
        "duration": "1h0s", # fake
        "id": 0, # fake
        "language": "en",
        "published_at": date_start, # fake
        "thumbnail_url": "", # fake
        "title": "Chat Dump", # fake
        "type": "archive", # fake
        "url": "", # fake
        "user_id": Twitch_userid,
        "user_name": Twitch_channel,
        "view_count": 1000,
        "viewable": "public"
    }
}

def connect():

    print( "connecting to " + Twitch_channel + " as " + Twitch_user )
    
    irc = socket.socket()

    irc.connect(("irc.twitch.tv", 6667))
    
    # get advanced ircv3 features
    if ls_cap:
        irc.send( str.encode("CAP LS 302\r\n" ) )
        print( irc.recv(2048).decode('utf-8') )
        irc.send( str.encode("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership\r\n" ) )
        print( irc.recv(2048).decode('utf-8') )

    # log in
    irc.send( str.encode("PASS {passw}\r\n".format(passw=Twitch_pass) ) )
    irc.send( str.encode("NICK {user}\r\n".format(user = Twitch_user) ) )
    irc.send( str.encode("USER {user} {user} bla :{user}\r\n".format(user=Twitch_user) ) )
    irc.send( str.encode("JOIN #{channel}\r\n".format( channel=Twitch_channel.lower() ) ) )

    if ls_cap:
        irc.send( str.encode("CAP END\r\n" ) )

    #making sure we receive info that the subscribermode was turned off/on with "TWITCHCLIENT 2,3,4"
    #by enabling this, you'll lose the join/part messages
    # irc.send("TWITCHCLIENT 4\r\n")
    return(irc)

irc = connect()

def exit_gracefully(self, signum):
    global running
    print("Shutting down...")
    running = False

signal.signal(signal.SIGINT, exit_gracefully)
signal.signal(signal.SIGTERM, exit_gracefully)

#vanilla_prog = re.compile(r":(\w+)!\w+@\w+\.tmi\.twitch\.tv\s([A-Z]+)\s#(\w+)\s:(.*)")
#action_prog = re.compile(r"@(.*)\s:(\w+)!\w+@\w+\.tmi\.twitch\.tv\s([A-Z]+)\s#(\w+)\s:(.*)")
#serv_prog = re.compile(r"@(.*)\s\:tmi\.twitch\.tv\s([A-Z]+)\s#(\w+)\s:(.*)")

irc_patterns = (
    
    # 
)

action_prog = re.compile( r"@(?P<tags>.*)\s:(?P<user>\w+)!\w+@\w+\.tmi\.twitch\.tv\s(?P<action>[A-Z]+)\s#(?P<channel>\w+)\s:(?P<message>.*)" )
serv_prog = re.compile( r"@(?P<tags>.*)\s\:tmi\.twitch\.tv\s(?P<action>[A-Z]+)\s#(?P<channel>\w+)\s?:?(?P<message>.*)?" )
# action_prog = re.compile(r"@(?P<tags>.*)\s:(?P<user>\w+)!\w+@\w+\.tmi\.twitch\.tv\s(?P<action>[A-Z]+)\s#(?P<channel>\w+)\s:(?P<message>.*)")

# privmsg_prog = re.compile(r"@(.*)\s:(\w+)!\w+@\w+\.tmi\.twitch\.tv\sPRIVMSG\s#(\w+)\s:(.*)")
# clearchat_prog = re.compile(r"@(.*)\s\:tmi\.twitch\.tv\sCLEARCHAT\s#(\w+) :(\w+)")

def saveJSON():
    with open(output_path, 'w') as outfile:

        print("Saving JSON...")

        time_duration = time.time() - time_start
        hours, remainder = divmod(time_duration, 3600)
        minutes, seconds = divmod(remainder, 60)

        total_duration = "{hour}h{minute}m{second}s".format(hour=round(hours), minute=round(minutes), second=round(seconds))
        
        jsondata['video']['duration'] = total_duration
        json.dump(jsondata, outfile)

        print("JSON saved, hopefully!")
    
    print("Saving raw txt...")
    outfile = open(output_path + ".txt", 'w+', encoding='utf-8')
    outfile.write(raw_text)
    outfile.close()

num_since_saved = 0

def parse_irc_tags( raw_tags ):

    tags = {}
    split_tags = raw_tags.split(";")
    for tag in split_tags:
        tags[ tag.split("=")[0] ] = tag.split("=")[1]
        # print( "Tag: " + key + " = " + value )
    
    return tags

def parse_emoticons( raw_data ):
    # 304253289:12-22/304253291:24-34/304253295:36-46
    # 555555563:13-14,29-30,45-46,61-62,77-78,93-94,109-110,125-126,141-142,157-158,173-174,189-190,205-206
    emoticons = []
    if raw_data:
        for emote_group in raw_data.split("/"):
            emote_id = emote_group.split(":")[0]
            emote_all_pos = emote_group.split(":")[1]
            for emote_pos in emote_all_pos.split(","):
                emote_data = {
                    "_id": emote_id,
                    "begin": int(emote_pos.split("-")[0]),
                    "end": int(emote_pos.split("-")[1]),
                }
                # print( emote_data )
                emoticons.append(emote_data)

    return emoticons

def parse_badges( raw_data ):
    #{'_id': '1035670', 'begin': '0', 'end': '6'}
    #{'_id': '1035663', 'begin': '155', 'end': '158'}
    #{'_id': '1035693', 'begin': '160', 'end': '167'}
    #{'_id': '1035664', 'begin': '169', 'end': '175'}

    # subscriber/3,premium/1
    badges = []
    raw_badges = raw_data.split(",")
    if raw_badges:
        for badge_pair in raw_badges:
            if not badge_pair:
                continue
            badges.append({
                "_id": badge_pair.split("/")[0],
                "version": badge_pair.split("/")[1],
            })

    return badges

while( True ):

    if not running:
        break

    ready = select.select([irc], [], [], 10)

    buff_raw = b''

    if ready[0]:
        buff_raw += irc.recv( 1024 )
    else:
        print("No response, retrying...")
        continue

    # while True:
    #     if not running:
    #         break
    #     newdata = irc.recv( 1024 )
    #     if not newdata:
    #         break
    #     buff_raw += newdata

    try:
        buff_utf = buff_raw.decode('utf-8')
    except UnicodeDecodeError as err:
        print("Couldn't decode packet (" + str(err) + "): ", buff_raw)
        continue
        pass
    
    # print( "Buffer >> ", buff_utf )
    # print( "" )

    print(" >> Buff >> " + buff_utf[0:160] )

    buff_split = buff_utf.split("\n")
    # print("Buffer newlines: " + str( len( buff_split ) ) )
    for buf in buff_split[:-1]:

        # print(" >> Line >> " + buf)
        # print(" >> Line >> " + buf[0:160] )

        #to keep the connection alive, we have to reply to the ping
        #Twitch terminates the connection if it doesn't receive a reply after 3 pings
        
        if "PING" in buf:
            print(">> Received ping")
            buf = str.encode("PONG tmi.twitch.tv\r\n")
            irc.send(buf)
            continue

        if buf == ":tmi.twitch.tv RECONNECT":
            print(">> Received reconnect!")
            irc = connect()
            continue

        # if buf[0] != "@":
        #     print( "Corrupt >> " + str(buf) )
        #     print( "" )
        
        
        # privmsg_data = privmsg_prog.match( buf )
        # clearchat_data = clearchat_prog.match( buf )

        irc_action = None

        action_data = action_prog.match( buf )
        if action_data:
            irc_tags = action_data.group("tags")
            irc_user = action_data.group("user")
            irc_action = action_data.group("action")
            irc_channel = action_data.group("channel")
            irc_message = action_data.group("message")
        else:
            serv_data = serv_prog.match( buf )
            if serv_data:
                irc_tags = serv_data.group("tags")
                # irc_user = serv_data.group("user")
                irc_action = serv_data.group("action")
                irc_channel = serv_data.group("channel")
                irc_message = serv_data.group("message")

        
            # print(irc_user, irc_action, irc_channel, irc_message)
        
        if irc_action == "PRIVMSG":

            offset = time.time() - time_start
            now = datetime.datetime.utcnow()

            body_text = irc_message

            # unsure how to handle this yet
            body_text = body_text.replace("\u0001ACTION", "")
            body_text = body_text.replace("\x01", "")
            body_text = body_text.strip()

            tags = None

            if irc_tags:

                tags = parse_irc_tags( irc_tags )
           
                emoticons = parse_emoticons( tags['emotes'] )

                badges = parse_badges( tags['badges'] )
                
                fragments = []

                text_buffer = ""

                if emoticons:

                    for i, letter in enumerate(body_text):
                        
                        text_buffer += letter
                        
                        has_emote = False
                        
                        for emote in emoticons:
                            
                            #if i >= emote['begin'] and i <= emote['end']:
                            #    has_emote = True
                            
                            if i+1 == emote['begin']:
                                # text node
                                fragments.append({
                                    "text": text_buffer
                                })
                                # print("Append text: " + text_buffer)
                                text_buffer = ""
                            
                            if i == emote['end']:
                                # emoticon node
                                fragments.append({
                                    "emoticon": {
                                        "emoticon_id": emote["_id"]
                                    },
                                    "text": text_buffer
                                })
                                # print("Append emoticon: " + text_buffer)
                                text_buffer = ""
            
                else:
                    fragments.append({
                        "text": body_text
                    })
        
            comment = {
                "commenter": {
                    "_id": tags["user-id"],
                    "bio": None, # fake
                    "created_at": now.strftime( dateformat ),
                    "display_name": tags["display-name"],
                    "logo": None, # fake
                    "name": irc_user,
                    "type": "user", # fake
                    "updated_at": now.strftime( dateformat )
                },
                "message": {
                    "body": body_text,
                    "emoticons": emoticons,
                    "fragments": fragments,
                    "is_action": False, # fake
                    "user_badges": badges,
                    "user_color": tags["color"] or "#FFFFFF",
                    "user_notice_params": {} # fake
                },
                "source": "chat", # fake
                "state": "published", # fake
                "content_offset_seconds": round(offset, 4),
                "created_at": now.strftime( dateformat ),
                "updated_at": now.strftime( dateformat )
            }
            
            jsondata['comments'].append( comment )
            # print( "Message >> " + comment['commenter']['name'] + ": " + comment['message']['body'] )
            raw_text += "<{date}> {user}: {message}\n".format( date=now.strftime(dateformat), user=tags["display-name"], message=body_text )
            
            # num_since_saved += 1
            # if num_since_saved > num_to_save:
            #     print("Reached {num} messages, saving just to be sure!".format(num=num_to_save))
            #     num_since_saved = 0
            #     saveJSON()
            if time.time() > last_save + 60:
                print("Saving after one minute just to be sure!")
                last_save = time.time()
                saveJSON()

            # print( " Emotes: ", emoticons )
            # print( " Badges: ", badges )
            # print( " Fragments: ", fragments )
            # print( "" )
            # chat_log.write("{time}{user}:{message}\r\n".format(,,))
        
        #elif clearchat_data:
        #    
        #    tags = {}
        #    raw_tags = clearchat_data.group(1).split(";")
        #    for tag in raw_tags:
        #        tags[ tag.split("=")[0] ] = tag.split("=")[1]
        #        # print( "Tag: " + key + " = " + value )
        #
        #    print( "Clear chat >> ", tags)
        
        elif irc_action == "ROOMSTATE":
            print( "Room state >> ", irc_message )
        elif irc_action == "USERNOTICE":
            print( "User notice >> ", irc_user, irc_message )
        elif irc_action == "CLEARCHAT":
            print( "Clear chat >> ", irc_user, irc_message )
        # else:
        #     print( "Unhandled >> " + buf )

        # except:
        #     try:
        #         with open(chat_log_path+"Twitch_logger.txt","a+") as chat_log:
        #             print( "Info: " + buf )
        #             chat_log.write("{time} - {message}\r\n".format( time=datetime.date.today().strftime(dateformat), message=buf ))
        #     #if there is an error, this will print exactly what went wrong, and just continue if possible, because of the while loop
        #     #Without Try/Except the script would stop completely
        #     except Exception as error:
        #         print(error)

print("Exited loop...")

saveJSON()
