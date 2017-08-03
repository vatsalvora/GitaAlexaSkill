'use strict';
var Alexa = require("alexa-sdk");
var appId = 'APPID From Developer Console';

exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.appId = appId;
    alexa.dynamoDBTableName = 'DYNAMODBTABLENAME'; //Table Name
    alexa.registerHandlers(newSessionHandlers, singModeHandlers, startHandlers);
    alexa.execute();
};

var states = {
    SINGMODE: '_SINGMODE', // User is giving verse number.
    STARTMODE: '_STARTMODE'  // Prompt the user to start or restart the game.
};

//Number of Verses in Each chapter
const shlokas = [47,72,43,42,29,47,30,28,34,
42,55,20,35,27,20,24,28,78];

//s3 url for audio files
const awsUrl = 'https://s3.amazonaws.com/BUCKET_NAME/audio/';

//Initial Launch
var newSessionHandlers = {
    'LaunchRequest': function() {
        this.handler.state = states.STARTMODE;
        this.emit(':ask', 'Welcome to Gita. Give me a verse number and chapter number to sing.',
            'Say stop to quit.');
    },
    "AMAZON.StopIntent": function() {
      this.emit(':tell', "Goodbye!");  
    },
    "AMAZON.CancelIntent": function() {
      this.emit(':tell', "Goodbye!");  
    },
    'SessionEndedRequest': function () {
        console.log('session ended!');
    },
    'Unhandled': function() {
        //console.log(JSON.stringify(this.event.request));
        console.log("UNHANDLED New");
        this.response.audioPlayerStop();
        this.emit(':responseReady');
    }
};

//Format Number
function format_num(num)
{
    num = parseInt(num);
    if(num<10)
    {
        num = "0"+num;
    }
    else
    {
        num = num.toString();
    }
    return num;
}

//Start Mode
var startHandlers = Alexa.CreateStateHandler(states.STARTMODE, {
    'LaunchRequest': function () {
        this.handler.state = '';
        this.emit(':ask', 'Great! ', 'Try saying a verse number.');
    },
    //Sing a specific verse from a specific chapter
    'SayVerseIntent': function() {
        var verse = parseInt(this.event.request.intent.slots.versenum.value);
        var chapter = parseInt(this.event.request.intent.slots.chapternum.value);
        const speechOutput = 
        "<audio src='"+awsUrl+"ch"+format_num(chapter)+"/ch"
        +format_num(chapter)+"-v"+format_num(verse)+".mp3'/>";
        this.attributes['verse'] = {chapter:chapter,verse:verse};
        this.emit(':ask', speechOutput, "Say another verse number or quit.");
    },
    //Sing a random verse
    'SingVerseIntent': function() {
        var chapter = Math.floor(Math.random() * 18)+1;
        var verse  = Math.floor(Math.random() * shlokas[chapter-1])+1;
        const speechOutput = 
        "<audio src='"+awsUrl+"ch"+format_num(chapter)+"/ch"
        +format_num(chapter)+"-v"+format_num(verse)+".mp3'/>";
        this.attributes['verse'] = {chapter:chapter,verse:verse};
        this.emit(':ask', speechOutput, "Say another verse number or quit.");
    },
    //Sing a specific chapter
    'SingChapterIntent': function(){
        var chapter = parseInt(this.event.request.intent.slots.chapternum.value);
        this.handler.state = states.SINGMODE;
        var playBehavior = 'REPLACE_ALL';
        var url = awsUrl+"chapters/ch"
        +format_num(chapter)+".mp3";
        var token = chapter.toString();
        var offsetInMilliseconds = 0;
        
        //Save to session
        this.attributes['token'] = token;
        this.attributes['playall'] = false;

        
        this.response.audioPlayerPlay(playBehavior, url, token, null, offsetInMilliseconds);
        this.emit(':responseReady');
    },
    //Sing the entire Gita
    'SingGitaIntent': function(){
        //Let Code know to sing the entire Gita

        this.handler.state = states.SINGMODE;
        var playBehavior = 'REPLACE_ALL';
        var url = awsUrl+"chapters/ch01.mp3";
        var token = '1';
        var offsetInMilliseconds = 0;

        //Save to session
        this.attributes['token'] = token;
        this.attributes['enqueuedToken'] = '0';
        this.attributes['playall'] = true;
        
        this.response.audioPlayerPlay(playBehavior, url, token, null, offsetInMilliseconds);
        this.emit(':responseReady');

    },
    //Repeat Verse
    'AMAZON.RepeatIntent': function() {
        var chapter = this.attributes['verse'].chapter;
        var verse  = this.attributes['verse'].verse;
        const speechOutput = 
        "<audio src='"+awsUrl+"ch"+format_num(chapter)+"/ch"
        +format_num(chapter)+"-v"+format_num(verse)+".mp3'/>";
        console.log(speechOutput);
        this.emit(':ask', speechOutput, "Say sing a verse for me to sing again or quit.");
    },
    'AMAZON.HelpIntent': function() {
        var message = 'Say a verse number and chapter number.';
        var remsg = "Say sing all chapters or quit";
        this.emit(':ask', message, remsg);
    },
    "AMAZON.StopIntent": function() {
        this.attributes['playbackFinished'] = true;
        this.attributes['enqueuedToken'] = '0';
        this.attributes['playall']=false;
        this.handler.state = states.STARTMODE;
        console.log("STOPINTENT");
        this.response.audioPlayerStop();
        this.emit(':responseReady');
    },
    "AMAZON.CancelIntent": function() {
        console.log("CANCELINTENT");
        this.response.audioPlayerStop();
        this.emit(':responseReady');
    },
    'SessionEndedRequest': function () {
        console.log("SESSIONENDEDREQUEST");
        this.emit(':saveState', true);
    },
    'Unhandled': function() {
        console.log("Unhandled Start");
        this.emit(':ask', 'Sorry I did not get that. ', 'Try saying a verse number or quit.');
    }
});

var singModeHandlers = Alexa.CreateStateHandler(states.SINGMODE, {
    'LaunchRequest': function () {
        var msg;
        var reprompt;
        if(this.attributes['playbackFinished'])
        {
            this.handler.state = states.STARTMODE;
            msg = "Hello! Ask me to sing a verse or chapter.";
            reprompt = "Try saying sing a verse or quit.";
        }
        else
        {
            msg = "Would you like to resume? Say yes or no.";
            reprompt = "Say yes or no.";
        }
        
        this.emit(':ask', msg, reprompt);
    },
    //Resume Singing the chapter
    'AMAZON.YesIntent' : function () {
        console.log('Resume Sing!!');
        // console.log(this.attributes['offsetInMilliseconds']);
        // console.log(this.attributes['token']);
        var token = this.attributes['token'];
        var playBehavior = 'REPLACE_ALL';
        var url = awsUrl+"chapters/ch"
        +format_num(token)+".mp3";
        console.log(url);
        this.attributes['enqueuedToken'] = '0';
        var offsetInMilliseconds = this.attributes['offsetInMilliseconds'];
        this.response.audioPlayerPlay(playBehavior, url, token, null, offsetInMilliseconds);
        this.emit(':responseReady');
    },
    //Return to Start Mode
    'AMAZON.NoIntent' : function () {
        this.attributes['playbackFinished'] = true;
        this.attributes['enqueuedToken'] = '0';
        this.attributes['playall']=false;
        this.handler.state = states.STARTMODE;
        var msg = "Hello! Ask me to sing a verse or chapter.";
        var reprompt = "Try saying sing a verse or quit.";
        this.emit(':ask', msg, reprompt);
    },
    'PlaybackStarted' : function () {
        console.log('Playback Started');
        this.attributes['token'] = this.event.request.token;
        this.attributes['playbackFinished'] = false;
        this.emit(':saveState', true);
    },
    'PlaybackStopped' : function () {
        this.attributes['token'] = this.event.request.token;
        this.attributes['offsetInMilliseconds'] = this.event.request.offsetInMilliseconds;
        console.log('Playback Stopped');
        console.log(this.attributes['offsetInMilliseconds']);
        this.emit(':saveState', true);
    },
    'PlaybackNearlyFinished' : function () {
        this.attributes['token'] = this.event.request.token;
        
        if(this.attributes['playall'])//If Playing the entire Gita
        {
            var chapter = parseInt(this.attributes['token'])+1;//Next Chapter to sing
            if(chapter>18) // Played all chapters
            {
                console.log('Playback Nearly Finished');
                this.attributes['enqueuedToken'] = '0';
                this.attributes['playall']=false;
                this.handler.state = states.STARTMODE;
                this.emit(':saveState', true);
            }
            else
            {
                console.log('Playback Nearly Finished');
                var token = chapter.toString();
                //Make sure chapter has not already been enqueued
                if(this.attributes['enqueuedToken'] !== token)
                {
                    var playBehavior = 'ENQUEUE';
                    var url = awsUrl+"chapters/ch"+format_num(token)+".mp3";
                    console.log("Enq ch-" + token);
                    var offsetInMilliseconds = 0;
                    var enqToken = this.event.request.token;
                    this.attributes['enqueuedToken'] = token; // The next chapter to play
                    this.response.audioPlayerPlay(playBehavior, url, token, enqToken, offsetInMilliseconds);
                    this.emit(':responseReady');
                }
                else
                {
                    console.log('Playback Nearly Finished');
                    this.emit(':saveState', true);
                }
            }
        }
    },
    'PlaybackFailed' : function () {
        console.log('Playback Failed');
        this.emit(':saveState', true);
    },
    'PlaybackFinished' : function () {
        this.attributes['token'] = this.event.request.token;
        if(this.attributes['playall'])
        {
            console.log('Playback Finished');
            this.emit(':saveState', true);

        }
        else
        {
            console.log('Playback Finished');
            //Reset Values 
            this.attributes['playbackFinished'] = true;
            this.attributes['enqueuedToken'] = '0';
            this.attributes['playall']=false;
            this.handler.state = states.STARTMODE;
            this.emit(':saveState', true);

        }
    },
    //Sing the next chapter if playing the entire Gita
    'AMAZON.NextIntent': function() {
        if(this.attributes['playall'])
        {
            var chapter = (parseInt(this.attributes['token'])+1);
            if(chapter > 18) {  
                chapter = 1; 
            }
            var token = chapter.toString();
            var playBehavior = 'REPLACE_ALL';
            var url = awsUrl+"chapters/ch"+format_num(token)+".mp3";
            var offsetInMilliseconds = 0;
            this.attributes['token'] = token;
            this.response.audioPlayerPlay(playBehavior, url, token, null, offsetInMilliseconds);
            this.emit(':responseReady');
            
        }
    },
    //Sing the previous chapter if playing the entire Gita
    'AMAZON.PreviousIntent': function() {
        if(this.attributes['playall'])
        {
            var chapter = (parseInt(this.attributes['token'])-1);
            if(chapter < 1){
                chapter = 18;
            }
            var token = chapter.toString();
            var playBehavior = 'REPLACE_ALL';
            var url = awsUrl+"chapters/ch"+format_num(token)+".mp3";
            var offsetInMilliseconds = 0;
            this.attributes['token'] = token;
            this.response.audioPlayerPlay(playBehavior, url, token, null, offsetInMilliseconds);
            this.emit(':responseReady');
            
        }
    },
    //Pause Singing
    'AMAZON.PauseIntent': function() {
        console.log('Paused Sing!!');
        this.response.audioPlayerStop();
        this.emit(':responseReady');
    },
    //Resume Singing from offset
    'AMAZON.ResumeIntent': function() {
        console.log('Resume Sing!!');
        var token = this.attributes['token'];
        var playBehavior = 'REPLACE_ALL';
        var url = awsUrl+"chapters/ch"
        +format_num(token)+".mp3";
        this.attributes['enqueuedToken'] = '0';
        var offsetInMilliseconds = this.attributes['offsetInMilliseconds'];
        this.response.audioPlayerPlay(playBehavior, url, token, null, offsetInMilliseconds);
        this.emit(':responseReady');
    },
    //Repeat Chapter
    'AMAZON.RepeatIntent': function() {
        console.log('Repeat Sing!!');
        var token = this.attributes['token'];
        var playBehavior = 'REPLACE_ALL';
        var url = awsUrl+"chapters/ch"
        +format_num(token)+".mp3";
        this.attributes['enqueuedToken'] = '0';
        var offsetInMilliseconds = 0;
        this.response.audioPlayerPlay(playBehavior, url, token, null, offsetInMilliseconds);
        this.emit(':responseReady');
    },
    'AMAZON.StopIntent': function() {
        this.attributes['playbackFinished'] = true;
        this.attributes['enqueuedToken'] = '0';
        this.attributes['playall']=false;
        this.handler.state = states.STARTMODE;
        console.log("STOPINTENT");
        this.response.audioPlayerStop();
        this.emit(':responseReady');
    },
    'SessionEndedRequest': function () {
        this.handler.state = '';
        this.attributes['playbackFinished'] = true;
        console.log("SESSIONENDEDREQUEST");
        this.emit(':saveState', true);
    },
    'Unhandled': function() {
        console.log("UNHANDLED Sing");
        this.response.audioPlayerStop();
        this.emit(':responseReady');
    }
});