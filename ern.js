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
        
        return {
            pad: pad,
            standardSequenceID: standardSequenceID,
            matchRating: matchRating
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
        
        function getMetaData(searchTerm, callback){
            log.log(searchTerm);
            function searchForSeries(searchTerm, callback){
                log.log(searchTerm);
                var metaData = [];
                tvdb.getSeriesByName(searchTerm)
                .then(response => { 
                    //log.log(response);
                    for(var i = 0, l = response.length; i < l; i++){
                        metaData.push({
                            seriesName: response[i].seriesName,
                            id: response[i].id,
                            slug: response[i].slug,
                            firstAired: response[i].firstAired
                        });
                    }
                    log.log(metaData);
                    callback(metaData);
                })
                .catch(error => { log.error(error);  });
            };

            function getSeriesById(id, callback){
                
                tvdb.getSeriesAllById(id)
                .then(response => { 
                    callback(response);
                })
                .catch(error => { 
                    log.error(error);  
                    callback({episodes: []});
                });
            };

            function main(searchTerm, callback){
                var metaData = [];

                function processSearchResults(results, callback){
                    var result = results.shift();
                    log.log(result);
                    if(result && result.id){
                        result.episodes = [];
                        getSeriesById(result.id, function(response){
                            var episode = response.episodes.shift();
                            while(episode){
                                result.episodes.push({
                                    id: episode.id,
                                    airedSeason: episode.airedSeason,
                                    airedEpisodeNumber: episode.airedEpisodeNumber,
                                    episodeName: episode.episodeName,
                                    standardSequenceID: tools.standardSequenceID(episode.airedSeason, episode.airedEpisodeNumber)
                                });

                                episode = response.episodes.shift();
                            }
                            metaData.push(result);
                            processSearchResults(results, callback);
                        });
                    }else{
                        callback();
                    }
                };

                searchForSeries(searchTerm, function(results){
                    //log.log(results);
                    processSearchResults(results, function(){
                        callback(metaData);
                    });
                });
            }

            main(searchTerm, function(metaData){
                callback(metaData);
            });
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
                
                function processRating(episode){
                    var rating = tools.matchRating(filename, episode.episodeName);
                    if(rating.matchRating < rating){
                        rating.matchRating = rating;                        
                        rating.highestRatedMatch = episode;                        
                        rating.matchCollisions = []; //reset collision tracking
                    }else if(rating.matchRating === rating){
                        rating.matchCollisions.push(episode);
                    }
                };
                
                var episodes = series.episodes;
                var episode = episodes.shift();
                while(episode){
                    processRating(episode);
                    episode = episodes.shift();
                }
                return rating;
            },
            series: function(){
                
            }
        };
        
        
        return {
            
        };
    })();
    
    //search: 'Invader ZIM'
    
    
    
    /*
    getMetaData(searchTerm, function(metaData){
        log.log(JSON.stringify(metaData));
    });//*/
    
    api.get.episodesByID(75545, function(response){
        console.log(response);
    });
    
    /*
    getListOfFiles(dir, function(result){
        log.log(result);
    });//*/
    
    
    
})();