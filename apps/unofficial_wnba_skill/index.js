var express = require("express");
var alexa = require("alexa-app");
var request = require('request');
var dateFormat = require('dateformat');
var Speech = require('ssml-builder');
var amazonDateParser = require('amazon-date-parser');
var states = require('us-state-codes');

request.debug = false

var app = new alexa.app("unofficial_wnba_skill");

// Allow this module to be reloaded by hotswap when changed
module.change_code = 1;
module.exports = app;

// Query Parameters
var baseUrl = 'https://data.wnba.com/data/5s/v2015/json/mobile_teams/wnba/2018/league/10_full_schedule.json';
var params = {
  qs: {
  },
  headers: { 
    "Accept-Language": "en-US",
    Accept: "*/*",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.101 Safari/537.36",
    Referer: "https://www.wnba.com/",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
    Origin: "https://data.wnba.com",
  },
  url: baseUrl,
  json: true
};

// Config properties
var config = {
  pollingIntervalInMinutes: 1000
}

// Global Datastructure
var allGames = {};

// Custom intents
app.intent('ScheduleIntent', {
  "slots": { "GAMEDATE": "AMAZON.DATE" },
  "utterances": ["What games were played on {GAMEDATE}", "What games are scheduled for {GAMEDATE}",
                 "What games are playing on {GAMEDATE}", "What games were played {GAMEDATE}",
                 "What games are scheduled {GAMEDATE}", "{GAMEDATE}"]
}, function(req, res) {
  
  var gameDate = req.slot('GAMEDATE');
  console.log(gameDate);

  if (typeof gameDate === "undefined") {
    // If no date, use today
    gameDate = new Date();
    res.say("I don't understand the date you were asking about.  I'll provide today's schedule.");
  }
  else {
    try {
      var slotDate = new amazonDateParser(gameDate);
      gameDate = slotDate.startDate;
    }
    catch(e) {
      res.say("Sorry, I was unable to understand what date you were asking me about.");
      console.log(e.message);
      return;
    }
  }
  
  // Generate a response with the games
  generateGamesResponse(res, res, gameDate);

    // Let the session end.
  //res.shouldEndSession (false, "Would you like to hear about another shoe?");
});

function generateGamesResponse(req, res, gameDate) {
  console.log(gameDate);
  var now = new Date();
  var nowYear = now.getFullYear();
  var nowDateKey = dateFormat(now, "yyyy-mm-dd");
  
  var yearKey = gameDate.getFullYear();
  var dateKey = dateFormat(gameDate, "yyyy-mm-dd");
  
  if (typeof allGames[yearKey] === "undefined") {
    if (nowYear < yearKey) {
      var speech = new Speech();
      speech.say("Sorry, the schedule for the year ")
            .sayAs({
                    word: yearKey,
                    interpret: "date",
                    format: "y"
                  })
            .say(" has not been released yet.");
      var speechOutput = speech.ssml(true);
      res.say(speechOutput);
    }
    else {
      var speech = new Speech();
      speech.say("The WNBA played its first season in  ")
            .sayAs({
                    word: "1997",
                    interpret: "date",
                    format: "y"
                  });
      var speechOutput = speech.ssml(true);
      res.say(speechOutput);
    }
  }
  else if (typeof allGames[yearKey][dateKey] === "undefined") {
    // We don't have info for this date
    var speech = new Speech();
    var str = '';
    if (dateKey < nowDateKey) {
      str = "Sorry, there were no games played on ";
    }
    else {
      str = "Sorry, there are no games scheduled for ";
    }
    speech.say(str)
        .sayAs({
                  word: dateKey.replace(/-/g, ''),
                  interpret: "date",
                  format: "ymd"
              })
        .say(". ");
    var speechOutput = speech.ssml(true);
    res.say(speechOutput);

  }
  else {
    // Start with saying how many games there are.
    if (dateKey < nowDateKey) {
      var speech = new Speech();
      var str = '';
      if (allGames[yearKey][dateKey].length == 1) {
        str = "There was 1 game on ";
      }
      else {
        str = "There were " + allGames[yearKey][dateKey].length + " games on ";
      }
        
      speech.say(str)
            .sayAs({
                    word: dateKey.replace(/-/g, ''),
                    interpret: "date",
                    format: "ymd"
                  })
            .say(". ");
      var speechOutput = speech.ssml(true);
      res.say(speechOutput);
    }
    else {
      var speech = new Speech();
      var str = '';
      if (allGames[yearKey][dateKey].length == 1) {
        str = "There is 1 game scheduled for ";
      }
      else {
        str = "There are " + allGames[yearKey][dateKey].length + " games scheduled for ";
      }
        
      speech.say(str)
            .sayAs({
                    word: dateKey.replace(/-/g, ''),
                    interpret: "date",
                    format: "ymd"
                  })
            .say(". ");
      var speechOutput = speech.ssml(true);
      res.say(speechOutput);
    }
    
    // Talk about the game(s)
    allGames[yearKey][dateKey].forEach(function(game) {
        sayGameInfo(game, res, dateKey);
        console.log(game);
    });
  }
}

function sayGameInfo(game, res, dateKey) {
  if (typeof game === "undefined") {
    // Something went wrong
    return;
  } 
  
  // Game has been played
  if (game.homeScore !== null && game.homeScore != '' && game.gameStatus === 'Final') {
    var resStr = "";
    // Determine who won - home team won
    if (Number(game.homeScore) > Number(game.awayScore)) {
      resStr += "The " + game.homeTeam + " beat the " + game.awayTeam + 
        " by the score of " + game.homeScore + " to " + game.awayScore + ". ";
      if (game.seriesInfo === null || game.seriesInfo === '') {
        resStr += "The " + game.homeTeam + " improved their record to ";
        resStr += formatRecord(game.homeRecord) + ". ";
        resStr += "With the loss, the " + game.awayTeam + " dropped to ";
        resStr += formatRecord(game.awayRecord) + ".";
      }
    }
    else {
      resStr += "The " + game.awayTeam + " beat the " + game.homeTeam + 
        " by the score of " + game.awayScore + " to " + game.homeScore + ". ";
      if (game.seriesInfo === null || game.seriesInfo === '') {
        resStr += "The " + game.awayTeam + " improved their record to ";
        resStr += formatRecord(game.awayRecord) + ". ";
        resStr += "With the loss, the " + game.homeTeam + " dropped to ";
        resStr += formatRecord(game.homeRecord) + ".";
      }
    }
    res.say(resStr);
  }
  // Game is in future
  else {
    var resStr = "The " + game.awayTeam + " will take on the " + game.homeTeam +
        " at the " + game.gameArena +     
        " in " + game.gameCity + ", " + game.gameState; // TODO add Time:  + " at " + ".";
    if (game.seriesInfo !== null && game.seriesInfo !== '') {
      resStr += " " + game.seriesInfo + ".";
    }
    res.say(resStr);
  }
}

function formatRecord(record) {
  return record.replace(/(\d+)-(\d+)/g, "$1 wins and $2 losses"); 
}

// error handler example
app.error = function(e, request, response) {
  response.say("Something went wrong.  Error found: " + e.message);
}; 

// Builtin Intents
app.intent('AMAZON.StopIntent', endSession);
app.intent('AMAZON.CancelIntent', endSession);
app.intent('AMAZON.NavigateHomeIntent', endSession);

function endSession(request, response) {
  response.shouldEndSession(true);  
}

app.launch(function(req,res) {
  console.log("New Session");

	res.say("Welcome to the WNBA Helper. To hear how I can tell you about games on the " +
          "WNBA schedule, please say help.");
	res.shouldEndSession (false);
});

app.intent('AMAZON.HelpIntent', 
    {
        "slots": {},
        "utterances": [
            "help", "how to use", "what can I do"
        ]
    },
    function (request, response) {
	    response.say("The WNBA is a great league.  I can help you look up historical " +
                  "game information or the schedule going forward. To look up a game, ask " +
                  "what games are scheduled for a date? " +
                  "For example, what games are scheduled for August 5, 2019. Or, " +
                  "what games were played on September 12, 2018. What date " +
                  "would you like me to look up?");
      response.shouldEndSession(false);  
    }    
);

app.intent('AMAZON.FallbackIntent', 
    {
        "slots": {},
        "utterances": [
            "fallback"
        ]
    },
    function (request, response) {
	    response.say("I don't understand what you were asking.  Ask for help to learn more " +
                  "about this skill. I will provide you information on tonight's games. ");
      generateGamesResponse(request, response, new Date());
      response.shouldEndSession(false);  
    }    
);

app.sessionEnded(function(request, response) {
  endSession(request, response);
});

// Get data from WNBA
function getDataFromWNBA(year) { 
  console.log("Fetching Data..." + year);

  // Set to current year, if no year sent in.
  if (typeof year === 'undefined') {
    var now = new Date();
    year = now.getFullYear();
  } 
  
  // Set URL
  params.url = baseUrl.replace(/2018/, year);
  console.log(params.url);
  
  // Get data from WNBA
  request(params, function(err, r, body) {
    //console.log('err:', err); // Print the error if one occurred
    //console.log('statusCode:', r && r.statusCode); // Print the response status code if a response was received
    //console.log('body:', body); // Print the HTML for the Google homepage.
    
    if (err) {
      console.log(err.stack);
      console.log(err);
    } 
    else if (body && body.lscd) {
      body.lscd.forEach(function(monthData) {
        processMonth(monthData, year);
      });
    }
    
    //console.log(allGames['2018']['2018-09-12']); 
  });
}

function processMonth(monthData, year) {
  if (monthData && monthData.mscd && monthData.mscd.g) {
      monthData.mscd.g.forEach(function(gameData) {
        processGames(gameData, year);
      });
  }
}

function processGames(gameData, year) {
  var game = {
    id: gameData.gid,
    code: gameData.gcode,
    date: gameData.gdte,
    year: year,
    utcTime: gameData.utctm,
    homeTeam: gameData.h.tc + " " + gameData.h.tn,
    awayTeam: gameData.v.tc + " " + gameData.v.tn,
    homeScore: gameData.h.s,
    awayScore: gameData.v.s,
    homeRecord: gameData.h.re,
    awayRecord: gameData.v.re,
    seriesInfo: gameData.seri, 
    gameArena: gameData.an,
    gameCity: gameData.ac,
    gameState: states.getStateNameByStateCode(gameData.as),
    gameStatus: gameData.stt
  };

  if (typeof allGames[year] === 'undefined') {
    allGames[year] = {};
  }

  if (typeof allGames[year][game.date] === 'undefined') {
    allGames[year][game.date] = [];
  }
  allGames[year][game.date].push(game);
  //console.log(game); 
  
  // Todo adds points leader
  /*
  "ptsls": {
    "pl": [
      {
        "pid": "201886",
        "fn": "DeWanna",
        "ln": "Bonner",
        "val": "27",
        "tid": 1611661317,
        "ta": "PHO",
        "tn": "Mercury",
        "tc": "Phoenix"
      }
    ]
  }*/
}

function loadAllYears() {
  var now = new Date();
  var nowYear = now.getFullYear();
  for (var year = 1997; year <= nowYear; year++) {
    getDataFromWNBA(year);
  }
}

// Set the polling interval.
loadAllYears();
setInterval(getDataFromWNBA, 1000 * 60 * config.pollingIntervalInMinutes); // Every x minutes

