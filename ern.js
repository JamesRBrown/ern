(function(){
    //episode renamer
    
    
    var log = require('/home/node/jrb_modules/logging.js');
    
    log.config({ 
        console: true,          //turn on/off console logging
        //path: true,           //prepend file path
        //file: true,             //prepend filename
        line: true,             //prepend line number
        //func: true,             //prepend function name
        app: "ern"    //set app name, used for email function
    });//*/ 
    
    const fs = require('fs');

    
    var dir = "/mnt/stronghold/data/video/Animation/Series/Invader\ Zim";
    var searchTerm = "Invader ZIM";
    
    var tools = (function (){
        function pad(n, width, z) {
            z = z || '0';
            n = n + '';
            return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
        };
        
        function standardSequenceID (seasonNumber, episodeNumber){
            var amount = 2;
            return `S${pad(seasonNumber, amount)}E${pad(episodeNumber, amount)}`;
        };
        
        function matchRating(text, searchTerm){
            var matched = 0;
            
            if(text.toUpperCase().includes(searchTerm.toUpperCase())){
                matched = 1;
            }else{
                var terms = searchTerm.match(/\w+/g);
                        
                var matches = 0;

                for(var i = 0, l = terms.length; i < l; i++){
                    if(text.toUpperCase().includes(terms[i].toUpperCase())){
                        matches++;
                    }
                }
                matched = matches / terms.length;
            }
            
            return matched;
        };
        
        function simpleClone(o){
            return JSON.parse(JSON.stringify(o));
        }
        
        return {
            pad: pad,
            standardSequenceID: standardSequenceID,
            matchRating: matchRating,
            simpleClone: simpleClone
        };
        
    }());
    
    function getListOfFiles(dir, callback){
        log.log(dir);
        var listOfFiles = [];
        
        function filterDirectories(files){
            var file = files.shift();
            while(file){
                
                if(!fs.lstatSync(`${dir}/${file}`).isDirectory()){
                    listOfFiles.push(file);
                }
                
                file = files.shift();
            }
            callback(listOfFiles);
        };
    
        fs.readdir(dir, (err, files) => {
            if(err) log.error(err);
            filterDirectories(files);
        });
        
    };
    
    var api = (function(){
        const TVDB = require('node-tvdb');
        //API documentation: https://edwellbrook.github.io/node-tvdb/Client.html#getSeriesById
        const tvdb = new TVDB('4296B7GBEUY13UII');
        
        var get = {
            raw:{
                seriesByID : function(id, callback){
                    tvdb.getSeriesAllById(id)
                    .then(response => { 
                        callback(response);
                    })
                    .catch(error => { 
                        log.error(error);  
                        callback({episodes: []});
                    });
                }
            },
            filtered:{
                episodesByID : function(id, callback){        
                    var series = {
                        episodes: []
                    };

                    get.raw.seriesByID(id, function(response){
                        series.seriesName = response.seriesName;
                        series.firstAired = response.firstAired;
                        var episode = response.episodes.shift();
                        while(episode){
                            series.episodes.push({
                                id: episode.id,
                                airedSeason: episode.airedSeason,
                                airedEpisodeNumber: episode.airedEpisodeNumber,
                                episodeName: episode.episodeName,
                                standardSequenceID: tools.standardSequenceID(episode.airedSeason, episode.airedEpisodeNumber)
                            });

                            episode = response.episodes.shift();
                        }
                        
                        callback(series);
                    });
                }
            }
        };
        
        
        return {
            get:{
                seriesByID: get.raw.seriesByID,
                episodesByID: get.filtered.episodesByID
            }
        };
        
    })();
    
    var mapper = (function(){
        
        var rate = {
            episode: function(filename, series){
                var rating = {
                    filename: filename,
                    matchRating: 0,
                    highestRatedMatch: {},
                    matchCollisions: []
                };
                
                function processRating(episode, rating){
                    
                    //log.log(filename);
                    //log.log(episode);
                    var episodeRating = 0;
                    //log.log(episodeRating);
                    episodeRating = tools.matchRating(filename, episode.episodeName);
                    //log.log(episodeRating);
                    if(rating.matchRating < episodeRating){
                        //log.log('greater rating');
                        rating.matchRating = episodeRating;                        
                        rating.highestRatedMatch = episode;                        
                        rating.matchCollisions = []; //reset collision tracking
                    }else if(rating.matchRating === episodeRating){
                        //log.log('collision');
                        rating.matchCollisions.push(episode);
                    }else if(rating.matchRating > episodeRating){
                        //log.log('lower rating');
                    }else{
                        log.error('bad state!');
                    }
                    //log.log(rating);
                    return rating;
                };
                
                for(var i = 0, l = series.episodes.length; i < l ; i++){
                    rating = processRating(series.episodes[i], rating);
                }
                
                if(rating.matchCollisions.length){
                    log.error('Collisions!');
                    rating.matchRating = (rating.matchRating / rating.matchCollisions.length);
                    log.log(rating);                    
                    rating.collisions = true;
                }else{
                    rating.collisions = false;
                }
                
                    //log.log(rating);
                return rating;
            },
            series: function(files, series){
                //console.log(series);
                var ratings = [];
                var rating;
                var ratingScore = 0;
                var i = 0, l = files.length;
                for(; i < l; i++){
                    rating = rate.episode(files[i], series);
                    ratingScore += rating.matchRating;
                    ratings.push(rating);
                }
                
                ratingScore = (ratingScore / l);
                
                return {
                    seriesMatchRating: ratingScore,
                    matches: ratings
                };
            }
            
        };
        
        
        return {
            episode: rate.episode,            
            series: rate.series            
        };
    })();
    
    //search: 'Invader ZIM'
    
    
    
    /*
    getMetaData(searchTerm, function(metaData){
        log.log(JSON.stringify(metaData));
    });//*/
    //*
    api.get.episodesByID(75545, function(series){
        //console.log(series);
        getListOfFiles(dir, function(files){
            log.log(files);
            console.log(mapper.series(files, series));
        });
    });//*/
    
    
    /*
    api.get.episodesByID(75545, function(series){
        var filename = 'Invader Zim S01E10 Career Day.mp4';
        console.log(mapper.episode(filename, series));
    });//*/
    
    /*
    getListOfFiles(dir, function(result){
        log.log(result);
    });//*/
    
    
    
})();