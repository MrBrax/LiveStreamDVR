import socket
import time
import datetime
from random import random
import re
import json
import signal
import sys
import select
import argparse


parser = argparse.ArgumentParser( description='Dump twitch chat to JSON' )
parser.add_argument('--channel', type=str, help='Twitch username', required=True)
parser.add_argument('--output', type=str, help='Output path', required=True)
