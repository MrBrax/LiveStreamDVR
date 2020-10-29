import socket
import time
import datetime
from random import random
import re
import json
import signal
import sys

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
    irc.send( str.encode("CAP LS 302\r\n" ) )
    print( irc.recv(2048).decode('utf-8') )
    irc.send( str.encode("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership\r\n" ) )
    print( irc.recv(2048).decode('utf-8') )

    # log in
    irc.send( str.encode("PASS {passw}\r\n".format(passw=Twitch_pass) ) )
    irc.send( str.encode("NICK {user}\r\n".format(user = Twitch_user) ) )
    irc.send( str.encode("USER {user} {user} bla :{user}\r\n".format(user=Twitch_user) ) )
    irc.send( str.encode("JOIN #{channel}\r\n".format( channel=Twitch_channel.lower() ) ) )

    irc.send( str.encode("CAP END" ) )

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

privmsg_prog = re.compile(r"@(.*)\s:(\w+)!\w+@\w+\.tmi\.twitch\.tv\sPRIVMSG\s#(\w+) :(.*)")
clearchat_prog = re.compile(r"@(.*)\s\:tmi\.twitch\.tv\sCLEARCHAT\s#(\w+) :(\w+)")

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
    outfile = open(output_path + ".txt", 'w+')
    outfile.write(raw_text)
    outfile.close()

num_since_saved = 0

while( True ):

    if not running:
        break

    #buff as in buffer, but that is a registered python word/function
    buff_raw = irc.recv(8192)

    try:
        buff_utf = buff_raw.decode('utf-8')
    except UnicodeDecodeError as err:
        print("Couldn't decode packet (" + str(err) + "): ", buff_raw)
        continue
        pass
    
    # print("Buffer: " + buff)
    buff_split = buff_utf.split("\r\n")
    for buf in buff_split[:-1]:
        # print(" - line: " + buf)
        #to keep the connection alive, we have to reply to the ping
        #Twitch terminates the connection if it doesn't receive a reply after 3 pings
        
        if "PING" in buf:
            print("received ping")
            buf = str.encode("PONG tmi.twitch.tv\r\n")
            irc.send(buf)
            continue

        if buf == ":tmi.twitch.tv RECONNECT":
            print("received reconnect :S?")
            irc = connect()
            continue

        
        privmsg_data = privmsg_prog.match( buf )
        clearchat_data = clearchat_prog.match( buf )
        
        if privmsg_data:
            
            tags = {}
            raw_tags = privmsg_data.group(1).split(";")
            for tag in raw_tags:
                tags[ tag.split("=")[0] ] = tag.split("=")[1]
                # print( "Tag: " + key + " = " + value )

            # print(tags)

            offset = time.time() - time_start
            now = datetime.datetime.utcnow()

            body_text = privmsg_data.group(4)

            # unsure how to handle this yet
            body_text = body_text.replace("\u0001ACTION", "")
            body_text = body_text.replace("\x01", "")
            body_text = body_text.strip()

            # 304253289:12-22/304253291:24-34/304253295:36-46
            # 555555563:13-14,29-30,45-46,61-62,77-78,93-94,109-110,125-126,141-142,157-158,173-174,189-190,205-206
            emoticons = []
            if tags['emotes']:
                for emote_group in tags['emotes'].split("/"):
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
            
            fragments = []

            #{'_id': '1035670', 'begin': '0', 'end': '6'}
            #{'_id': '1035663', 'begin': '155', 'end': '158'}
            #{'_id': '1035693', 'begin': '160', 'end': '167'}
            #{'_id': '1035664', 'begin': '169', 'end': '175'}

            # subscriber/3,premium/1
            badges = []
            raw_badges = tags['badges'].split(",")
            if raw_badges:
                for badge_pair in raw_badges:
                    if not badge_pair:
                        continue
                    badges.append({
                        "_id": badge_pair.split("/")[0],
                        "version": badge_pair.split("/")[1],
                    })

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
                    "name": privmsg_data.group(2),
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
            print( "Message >> " + comment['commenter']['name'] + ": " + comment['message']['body'] )
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
        
        elif clearchat_data:
            
            tags = {}
            raw_tags = clearchat_data.group(1).split(";")
            for tag in raw_tags:
                tags[ tag.split("=")[0] ] = tag.split("=")[1]
                # print( "Tag: " + key + " = " + value )

            print( "Clear chat >> ", tags)
        
        else:
            print( "Unhandled >> " + buf )

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
