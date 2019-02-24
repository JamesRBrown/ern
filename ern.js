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
    const TVDB = require('node-tvdb');
    const tvdb = new TVDB('4296B7GBEUY13UII');
    
    var dir = "/mnt/stronghold/data/video/Animation/Series/Invader\ Zim";
    var searchTerm = "Invader ZIM";
    
    function getListOfFiles(dir, callback){
        log.log(dir);
        var listOfFiles = [];
        
        function filterDirectories(files){
            var file = files.shift();
            for(;file;){
                
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
    
    
    //search: 'Invader ZIM'
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
                callback(metaData);
            })
            .catch(error => { log.error(error);  });
        };
        
        function getSeriesById(id, callback){
            tvdb.getSeriesAllById(id)
            .then(response => { 
                callback(response);
            })
            .catch(error => { log.error(error);  });
        };
            
        function main(searchTerm, callback){
            var metaData = [];
            
            function processSearchResults(results, callback){
                var result = results.shift();
                if(result){
                    result.episodes = [];
                    getSeriesById(result.id, function(response){
                        var episode = response.episodes.shift();
                        for(;episode;){
                            result.episodes.push({
                                id: episode.id,
                                airedSeason: episode.airedSeason,
                                airedEpisodeNumber: episode.airedEpisodeNumber,
                                episodeName: episode.episodeName
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
    
    
    /*
    getMetaData(searchTerm, function(metaData){
        log.log(JSON.stringify(metaData));
    });//*/
    
    getListOfFiles(dir, function(result){
        log.log(result);
    });
    
})();