import socket
import time
import datetime
from random import random
import re
import json
import signal

# http://www.rikels.info/index.php/en/articles/55-enter-a-twich-chat-without-account

Twitch_user = "justinfan{random}".format(random=int(random()*9999999))
Twitch_pass = "blah"
Twitch_channel = "xQcOW"
Twitch_userid = "71092938"
chat_log_path = "./"
sub = False
sub_time = None

running = True

dateformat = "%Y-%m-%dT%H:%M:%SZ"

time_start = time.time()
date_start = datetime.datetime.now().strftime(dateformat)

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

while( True ):

    if not running:
        break

    #buff as in buffer, but that is a registered python word/function
    buff = irc.recv(8192).decode('utf-8')
    # print("Buffer: " + buff)
    buff = buff.split("\r\n")
    for buf in buff[:-1]:
        # print(" - line: " + buf)
        #to keep the connection alive, we have to reply to the ping
        #Twitch terminates the connection if it doesn't receive a reply after 3 pings
        
        if "PING" in buf:
            print("received ping")
            buf = str.encode("PONG tmi.twitch.tv\r\n")
            irc.send(buf)

        if buf == ":tmi.twitch.tv RECONNECT":
            print("received reconnect :S?")
            irc = connect()

        
        extracted_info = privmsg_prog.match( buf )
        # print(extracted_info)
        #extracted_info = re.compile(r"^:\w+!\w+@\w+\.tmi\.twitch\.tv PRIVMSG #\w+ :")
        if extracted_info:
            
            tags = {}
            raw_tags = extracted_info.group(1).split(";")
            for tag in raw_tags:
                tags[ tag.split("=")[0] ] = tag.split("=")[1]
                # print( "Tag: " + key + " = " + value )

            # print(tags)

            offset = time.time() - time_start
            now = datetime.datetime.now()

            body_text = extracted_info.group(4)

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
                        print( emote_data )
                        emoticons.append(emote_data)
            
            fragments = []

            #{'_id': '1035670', 'begin': '0', 'end': '6'}
            #{'_id': '1035663', 'begin': '155', 'end': '158'}
            #{'_id': '1035693', 'begin': '160', 'end': '167'}
            #{'_id': '1035664', 'begin': '169', 'end': '175'}

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
                            print("Append text: " + text_buffer)
                            text_buffer = ""
                        
                        if i == emote['end']:
                            # emoticon node
                            fragments.append({
                                "emoticon": {
                                    "emoticon_id": emote["_id"]
                                },
                                "text": text_buffer
                            })
                            print("Append emoticon: " + text_buffer)
                            text_buffer = ""

                        
            
            else:
                fragments.append({
                    "text": body_text
                })
        
            comment = {
                "commenter": {
                    "_id": tags["user-id"],
                    "bio": None,
                    "created_at": now.strftime( dateformat ),
                    "display_name": tags["display-name"],
                    "logo": None,
                    "name": extracted_info.group(2),
                    "type": "user",
                    "updated_at": now.strftime( dateformat )
                },
                "message": {
                    "body": body_text,
                    "emoticons": emoticons,
                    "fragments": fragments,
                    "is_action": False,
                    "user_color": tags["color"] or "#FFFFFF",
                    "user_notice_params": {}
                },
                "source": "chat",
                "state": "published",
                "content_offset_seconds": round(offset, 4),
                "created_at": now.strftime( dateformat ),
                "updated_at": now.strftime( dateformat )
            }
            
            jsondata['comments'].append( comment )
            print( "Message >> " + comment['commenter']['name'] + ": " + comment['message']['body'] )
            print( " Emotes: ", emoticons )
            print( " Badges: ", tags['badges'] )
            print( " Fragments: ", fragments )
            print( "" )
            # chat_log.write("{time}{user}:{message}\r\n".format(,,))
        else:
            print( "Failed regex: " + buf )

        # except:
        #     try:
        #         with open(chat_log_path+"Twitch_logger.txt","a+") as chat_log:
        #             print( "Info: " + buf )
        #             chat_log.write("{time} - {message}\r\n".format( time=datetime.date.today().strftime(dateformat), message=buf ))
        #     #if there is an error, this will print exactly what went wrong, and just continue if possible, because of the while loop
        #     #Without Try/Except the script would stop completely
        #     except Exception as error:
        #         print(error)

with open(Twitch_channel + '.json', 'w') as outfile:
    print("Output JSON")

    time_duration = time.time() - time_start
    hours, remainder = divmod(time_duration, 3600)
    minutes, seconds = divmod(remainder, 60)

    total_duration = "{hour}h{minute}m{second}s".format(hour=round(hours), minute=round(minutes), second=round(seconds))
    
    jsondata['video']['duration'] = total_duration
    json.dump(jsondata, outfile)