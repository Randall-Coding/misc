'use strict';

app.controller('agendaCtrl', ['$scope', '$route', 'config', 'pgService',
    function (
        $scope,
        $route,
        config,
        pgService
    ) {
        
        var meetingId = $route.current.params.meetingid;
        var templateId = $route.current.params.templateid;
        var videoId = $scope.videoId = $route.current.params.videoid;
        var originalVideoSrc = 'https://www.youtube.com/embed/' + videoId +'?autoplay=1&amp;rel=0&amp;modestbranding=1';

        config.getConfig().then(getAgendaHtml);



        function getAgendaHtml() {
            // var templateId = $scope.meeting.compiledMeetingDocuments && $scope.meeting.compiledMeetingDocuments[0] && $scope.meeting.compiledMeetingDocuments[0].meetingTemplateId;
            if(meetingId && templateId){        
                return pgService.getMeetingAgendaHtml(meetingId, templateId).then(function (data) {
                    var $container = $('.agenda-container');

                    $container.html(data.html);
                    formatHtml();

                    if (videoId){
                        var $frame = $('#ytplayer');
                        $frame.attr('src', originalVideoSrc);
                    }

                });
            }
        }

        function formatHtml(){
            var sup = $('[data-sectionid]')
            //add attachment icon
            $('.glyphicon-paperclip').append('<i class="icon-paperclip"></i>');
            $('.meeting-item').on('click', loadItemAttachments);
            if (videoId) {
                $('.meeting-item').find('.agenda-item').append('<div class="item-attachment video-jump">' +
                    '<i class="icon-video"></i><span>Watch</span>' +
                    '</div>').find('.video-jump').on('click', function (e) {
                        e.stopPropagation();
                        e.preventDefault();
                        var itemId = $(this).closest('.meeting-item')[0].dataset.itemid;        
                        pgService.getItemVideoLocationPublic(itemId).then(function(data){
                            if (data.seconds && $('#ytplayer')){
                                $('#ytplayer').attr('src', originalVideoSrc + '&start=' + data.seconds);
                            }
                        });
                    });
            }


        }

        function loadItemAttachments(){
            var hasAttachments = !!this.dataset.hasattachments && this.dataset.hasattachments.toLowerCase() == 'true';
            
            if(!hasAttachments) return;

            var $item = $(this);
            var id = this.dataset.itemid;


            if(!this.dataset.attachmentsloaded){
                var $container = $('<div class="attachment-container"></div>');
                $item.find('.agenda-item').append($container);
                pgService.getMeetingItemAttachmentsPublic(id).then(function(attachments){
                    $container.data('height', (30*attachments.length));
                    console.log($container.data);
                    attachments.forEach(function(attachment){
                        $container.append(attachmentHtml(attachment))
                    });
                    toggleItemAttachments($item);
                });
                this.dataset.attachmentsloaded = true;
            }else{
                toggleItemAttachments($item);
            }


        }

        function toggleItemAttachments($item){
            var $container = $item.find('.attachment-container').toggleClass('show');
            if ($container.hasClass('show')){
                $container.css({ height: $container.data().height})
            }else{
                $container.css({ height: 0 })
            }
        }

        function attachmentHtml(attachment){
            var $attachment = $('<div class="item-attachment" id="attachment_'+attachment.id+'" data-id="'+attachment.id+'">'+
                '<i class="icon-pdf-doc"></i><span>' + attachment.name + '</span>'+
                '</div>');
            $attachment.on('click', function (e) { downloadItemAttachment(e, attachment) });
            return $attachment;
        }

        function downloadItemAttachment(e, attachment){
            e.stopPropagation();
            e.preventDefault();

            pgService.getPdfDownloadUrlPublic(attachment.id).then(function(url){
                window.location = url;
            })
        }

    }]);
;'use strict';

app.controller('fileReaderCtrl', ['$scope', '$route', 'config', 'pgService',
    function (
        $scope,
        $route,
        config,
        pgService
    ) {
        var id = $route.current.params.id;    
        var frame = $('.file-reader');

        if(id){
            config.getConfig().then(function(){

                pgService.getPublishedDownloadUrl(id).then(function (url) {
                    // console.log(url);
                    // frame[0].src = url;

                });

            });


        }


    }]);
;'use strict';

app.controller('mainCtrl', ['$scope', '$q', 'dataStore', 'pgService', 'helpers', 'config', 'i18n', '$location',
  function(
    $scope,
    $q,
    dataStore,
    pgService,
    helpers,
    config,
    i18n,
    $location
  ) {
    var cancellers = [];
    var staticStartDate = helpers.formatDate(new Date(), -1 * 365 * 50); // 50 years back
    var staticEndDate = helpers.formatDate(new Date(), 1 * 365 * 50); // 50 years ahead
    var today = new Date().getTime();
    var monthMeetingDates = {};
    var monthEnds = {'1':'31','2':'28','3':'31','4':'30','5':'31','6':'30','7':'31','8':'31','9':'30','10':'31','11':'30','12':'31'};
    
    config.getConfig().then(init);
    // pgService.getAuthKey().then(init);
    $scope.$on('$destroy', onDestroy);

    function init(){
      $scope.switchLocale = switchLocale;
      $scope.onCalendarSelect = onCalendarSelect;
      $scope.openMeetingFile = openMeetingFile;
      $scope.openMeetingHtml = openMeetingHtml;
      $scope.openSpeakerRequest = openSpeakerRequest;
      $scope.setMonthMeetingDates = setMonthMeetingDates;
      $scope.toggleSortOrder = toggleSortOrder;
      $scope.openFile = openFile;
      $scope.openVideo = openVideo;
      $scope.search = search;
      $scope.clearSearchResults = clearSearchResults;
      $scope.clearSearch = clearSearch;
      $scope.config = config;
      $scope.localeDropdown = false;
      $scope.results = [];
      $scope.meetingTypes = [];
      $scope.committeeTypes = [];
      $scope.upcomingMeetings = [];
      $scope.meetingType = '';
      $scope.committeeType = '';
      $scope.searchTerm = '';
      $scope.startDate = '';
      $scope.endDate = '';
      $scope.sortOrder = 'timestamp';
      $scope.locale = config.locales[i18n.locale];
      $scope.locales = Object.keys(config.locales).map(function (e) {
        return config.locales[e]
      });

      $scope.i18n = {
        agenda: i18n.get('agenda'),
        attachments: i18n.get('attachments'),
        between: i18n.get('between'),
        calendar: i18n.get('calendar'),
        clear: i18n.get('clear'),
        committees: i18n.get('committees'),
        contact: i18n.get('contact'),
        date: i18n.get('date'),
        email: i18n.get('email'),
        from: i18n.get('from'),
        forKeyword: i18n.get('for-keyword'),
        in: i18n.get('in'),
        liveMeeting: i18n.get('live-meeting'),
        loading: i18n.get('loading'),
        meeting: i18n.get('meeting'),
        meetingType: i18n.get('meeting-type'),
        minutes: i18n.get('minutes'),         
        on: i18n.get('on'),
        requestToSpeak: i18n.get('request-to-speak'),
        results: i18n.get('results'),
        resultsFor: i18n.get('results-for'),
        search: i18n.get('search'),
        subTitle: $scope.locale.i18n['sub-title'],
        summary: i18n.get('summary'),
        text: i18n.get('text'),
        time: i18n.get('time'),
        title: $scope.locale.i18n['title'],
        to: i18n.get('to'),
        upcomingMeetings: i18n.get('upcoming-meetings'),
        video: i18n.get('video'),
        web: i18n.get('web')
      };

      $scope.locales.forEach(function(loc){
        loc.name = i18n.get(loc.key);
      })

      $scope.showSpeaker = config.features && config.features['speaker-request'];
      
      // pgService.getMeetingTypesPublic().then(function(data){
      //   _.each(data,function(type){
      //     type.alias = dataStore.getMeetingTypeAlias(type.name);
      //   });
      //   $scope.meetingTypes = data;
      // });

      pgService.getCommitteesPublic().then(function (data) {
        _.each(data, function (type) {
          type.alias = dataStore.getCommitteeTypeAlias(type.name);
        });
        $scope.committeeTypes = data;
      });

      $scope.loading = true;
      pgService.getUpcomingMeetingsPublic().then(function(data){
        $scope.results = $scope.upcomingMeetings = formatResults(data);
        $scope.isSearch = false;
        $scope.resultsTitle = $scope.i18n.upcomingMeetings;
        $scope.liveMeeting = _.find($scope.results,function(result){
          return result.custom_tags && result.English_Video && result.English_Video === config.sire.liveMeetingUrl;
        });
      }).finally(function(){
        $scope.loading = false;
      });

      setMonthMeetingDates(new Date().getFullYear(), new Date().getMonth()+1);

    }

    
    function clearSearchResults(){
      $scope.results = $scope.upcomingMeetings;
      $scope.isSearch = false;
      $scope.sortOrder = 'timestamp';
      $scope.resultsTitle = $scope.i18.upcomingMeetings;
    }

    function clearSearch(){
      $scope.meetingType = '';
      $scope.startDate = '';
      $scope.endDate = '';
      $scope.searchTerm = '';
    }

    function search(){
      if (!$scope.startDate.length && !$scope.endDate.length && !$scope.committeeType.length && !$scope.searchTerm.length) return;

      if($scope.startDate && !$scope.endDate){
        $scope.endDate = $scope.startDate;
      }

      if ($scope.endDate && !$scope.startDate) {
        $scope.startDate = $scope.endDate;
      }
      
      var useStaticDates = ((!!$scope.committeeType.length || !!$scope.searchTerm) && !$scope.endDate && !$scope.startDate);
      var params = {
        // meetingTypeId: $scope.meetingType,
        CommitteeId: $scope.committeeType,
        from: helpers.formatDate($scope.startDate) || (useStaticDates && staticStartDate) || '',
        to: helpers.formatDate($scope.endDate) || (useStaticDates && staticEndDate) || '',
        text: $scope.searchTerm
      };

      if($scope.searchTerm) return fullTextSearch(params);
      
      $scope.loading = true;
      $scope.isSearch = true;
      pgService.meetingSearchPublic(params).then(function (data) {
        var committee = _.find($scope.committeeTypes,function(i){
          return i.id == $scope.committeeType;
        });
        $scope.results = formatResults(data);
        $scope.resultsTitle = $scope.i18n.results;
        $scope.searchCriteria = buildSearchString(committee && committee.alias, $scope.startDate, $scope.endDate, $scope.searchTerm);
        $scope.sortOrder = '-timestamp';
      }).finally(function(){
        $scope.loading = false;
      });
      
    }

    function buildSearchString(mt, sd, ed, kw){
      var map = {
        committeeType: mt ? ' '+$scope.i18n.in+' <span>' + mt + '</span>' : '',
        startDate: sd ? (sd && ed && sd != ed ? ' ' + $scope.i18n.between + ' ' : ' ' + $scope.i18n.on +' ') + '<span>' + sd + '</span>' : '',
        endDate: ed && ed !== sd ? '<span>' + ed + '</span>'  : '',
        keyword: kw ? ' ' + $scope.i18n.forKeyword +' <span>"' + kw +'"</span>': '',
        dash: sd && ed && sd != ed ? ' - ':'' 
      };
      // var map = {
      //   meetingType: mt ? '"' + mt + '"' : '',
      //   startDate: sd ? '"' + sd + '"' : '',
      //   endDate: ed && ed !== sd ? '"' + ed + '"' : '',
      //   keyword: kw ? '"' + kw + '"' : '',
      //   for: mt || kw ? ' for ' : '',
      //   in: mt && kw ? ' in ' : '',
      //   on: (sd && !ed) || (sd && sd == ed) ? ' on ' : '',
      //   between: sd && ed && sd != ed ? ' between ' : '',
      //   and: sd && ed && sd != ed ? ' and ' : ''
      // };


      // return 'for keyword'
      // return 'for keyword in meetingType'
      // return 'for keyword in meetingType on startDate'
      // return 'for keyword in meetingType between startDate and endDate'
      // return 'for meetingType'
      // return 'for meetingType on startDate'
      // return 'for meetingType between startDate and endDate'
      // return 'on startDate'
      // return 'between startDate and endDate'

      return $scope.i18n.search+':' + map.keyword + map.committeeType + map.startDate + map.dash + map.endDate;

    }

    function fullTextSearch(params){

      $scope.loading = true;
      $scope.isSearch = true;
      
      $q.all([
        pgService.meetingSearchPublic(params)
      ]).then(function(data){
        // var meetings = data[0];
        var committee = _.find($scope.committeeTypes, function (i) {
          return i.id == $scope.committeeType;
        });
        $scope.results = formatResults(data[0]);
        // _.each($scope.results, function(result){
        //   var found = _.find(meetings,{meet_id: result.MEET_ID});
        //   if(found) _.extend(result,found);
        // });
        $scope.resultsTitle = $scope.i18n.results;
        $scope.searchCriteria = buildSearchString(committee && committee.alias, $scope.startDate, $scope.endDate, $scope.searchTerm);
        $scope.sortOrder = '-timestamp';
      }).finally(function(){
        $scope.loading = false;
      });




    }

    function onDestroy(){
      cancellers.forEach(function(fn){fn();});
    }

    function onCalendarSelect(dateText, inst){
      $scope.loading = true;
      $scope.isSearch = true;
      pgService.getMeetingsByDateRangePublic(dateText, helpers.formatDate(dateText,1)).then(function(data){
        $scope.results = formatResults(data);
        $scope.resultsTitle = $scope.i18n.resultsFor+ ' '+ dateText;
        $scope.sortOrder = '-timestamp';
      }).finally(function () {
        $scope.loading = false;
      });
      setMonthMeetingDates(inst.currentYear, inst.currentMonth+1);
    }

    function openMeetingFile(document){
      console.log('Wez hacked teh javascript'); 
      pgService.getPublishedDownloadUrl(document.id).then(function (url) {
        window.location = url;
      });
      // var url = './#/file?id='+document.id;
      // window.open(url);
      
    }

    function openMeetingHtml(meeting){
		
      var agendaWindow = window.open('https://cityofhawthorne.primegov.com/portal/meetingview?meetingid=' + meeting.id + '&templateid=' + meeting.compiledMeetingDocuments[0].meetingTemplateId + (meeting.youtubeId ? '&videoid=' + meeting.youtubeId : ''));
    }

    function openFile(fileData) {
      
      if (fileData.loading) return;
      fileData.loading = true;

      var url = './#/file?id=' + fileData.FileID;
      window.open(url);

      fileData.loading = false;

    }

    function openSpeakerRequest(meeting){
      var speakerWindow = window.open('./#/speaker?meetingid=' + meeting.id + '&templateid=' + meeting.compiledMeetingDocuments[0].meetingTemplateId);
    }

    function getMonthMeetingDates(month, year){
      var my = '' + month + year
      if (monthMeetingDates[my]) return $q.when(monthMeetingDates[my]);
      $scope.loadingCalendarDates = true;
      return pgService.meetingSearchPublic({
        from: '1' + '/' + month + '/' + year,
        to: monthEnds[month] + '/' + month + '/' + year
      }).then(function(data){
        return monthMeetingDates[my] = helpers.getUniqueProp(data,'date');
      }).finally(function(){
        $scope.loadingCalendarDates = false;
      });
    }

    function setMonthMeetingDates(year, month){
      getMonthMeetingDates(month, year).then(function(dates){
        _.defer(function(){
          _.each(dates, function (date) {
            $('.' + helpers.formatDate(date).replace(/\//g, '-')).addClass('highlighted');
          });
        });
      });
    }

    function formatResults(results){
      return _.each(results,function(result){
        result.youtubeId = helpers.getYoutubeIdFromUrl(result.videoUrl);
        if(result.date) result.timestamp = new Date(result.date).getTime();
      });
    }

    function openVideo(videoText){
      var url = helpers.getYoutubeUrlFromText(videoText);
      if(url && url.length) window.open(url);
    }


    function switchLocale(locale) {
      $scope.locale = locale;
      $location.search('lang',locale.id);
    }


    function toggleSortOrder(prop){
      if($scope.sortOrder === prop){
        $scope.sortOrder = '-'+prop;
      }else{
        $scope.sortOrder = prop;
      }
    }

}]);


;'use strict';

var APIURL = 'http://denver.agenda.solutions/api';
var meetingUrl = '../public/data/meetings.json';
var itemsUrl = '../public/data/items.json';
var createSpeakerUrl = '/';
var speakersUrl = '../public/data/speakers.json';



app.controller('speakerCtrl', ['$scope', '$route', 'config', 'pgService','$q',
    function (
        $scope,
        $route,
        config,
        pgService,
        $q
    ) {

        var meetingId = $route.current.params.meetingid;
        var templateId = $route.current.params.templateid;

        config.getConfig().then(init);


        function init(){


            if (meetingId && templateId) {
                pgService.getMeetingAgendaHtml(meetingId, templateId).then(function (data) {
                    var $html = $(data.html)
                    var itemPromises = _.map($html.find('[data-sectionid]'), function(section){
                        return pgService.getMeetingSectionItemsPublic(section.dataset.sectionid, meetingId).catch(angular.noop);
                    });

                    if(itemPromises.length){
                        $q.all(itemPromises).then(function (itemSets) {
                            $scope.items = _.flatten(itemSets);
                            if(!$scope.items || !$scope.items.length){
                                $scope.zeroItemState = true;
                            }else{
                                $scope.moveStateForward();
                            }
                        });
                    }else{
                        $scope.zeroItemState = true;
                    }

                    
                });


            }

            $scope.states = [
                { id: 0, name: 'loading_items', label: 'Loading meeting items...' },
                { id: 1, name: 'item_select', label: 'Which items do you want to speak about?' },
                { id: 2, name: 'inFavor', label: 'How would you vote?' },
                { id: 3, name: 'personal', label: 'Let us know who you are' },
            ]

            $scope.upcomingMeetings = [];
            $scope.activeState = $scope.states[0];
            $scope.provinceNames = ['AK', 'AL', 'AR', 'AZ', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA', 'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE', 'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY']

            $scope.formData = [];
            
            $scope.submitData = {
                meetingId: meetingId,
                meetingItemId: null,
                firstName: "",
                lastName: "",
                address: "",
                city: "",
                state: "",
                zip: "",
                location: "",
                inFavor: false,
                yieldTimeToId: ""
            }

            $scope.locations = _.map(config.speakerLocations, function (loc) { return { name: loc } });
     

        }


        $scope.closeWindow = function(){
            window.close();
        }


        $scope.moveStateForward = function () {
            if ($scope.activeState.id < ($scope.states.length - 1)) {
                $scope.activeState = $scope.states[$scope.activeState.id + 1];
            }
        }

        $scope.moveStateBackward = function () {
            if ($scope.activeState.id > 0) {
                $scope.activeState = $scope.states[$scope.activeState.id - 1];
            }
        }

        $scope.setActiveState = function (id) {
            if (id < ($scope.states.length) && id >= 0) {
                $scope.activeState = $scope.states[id];
            }
        }



        $scope.setItem = function (item) {
            $scope.formData.push({ name: 'item', value: item, display: item.title });
            $scope.submitData.meetingItemId = item.id;
            $scope.moveStateForward();
        };

        $scope.removeItem = function (index) {
            $scope.setActiveState(index);
            $scope.formData.splice(index, $scope.formData.length - index);
        }

        $scope.setInfavor = function (inFavor) {
            $scope.formData.push({ name: 'Vote', value: inFavor, display: inFavor ? 'In Favor' : 'Opposed' });
            $scope.submitData.inFavor = inFavor;
            $scope.moveStateForward();
        }

        $scope.readyToSubmit = function () {
            var ready = (
                $scope.submitData && 
                $scope.submitData.meetingId &&
                $scope.submitData.meetingItemId &&
                $scope.submitData.firstName.length > 0)

            // if (ready && $scope.yieldTime) {
            //     ready = ($scope.submitData.yieldTimeToId.length > 0);
            // }
            return ready;
        }

        $scope.submitForm = function () {
            if ($scope.readyToSubmit()) {
                var speaker = $scope.submitData;
                speaker.location = speaker.location && typeof speaker.location == 'string' ? speaker.location : speaker.location.name;
                return pgService.createPublicSpeakerPublic(speaker).then(function (id) {
                    speaker.originalId = id;
                    speaker.id = 'public_' + id;
                    queSuccessMessage();
                    return speaker;
                },function () {
                    alert('There was a problem with your request');
                });
            }
        }

        $scope.goBack = function () {
            window.location.reload();
        }

        function queSuccessMessage() {
            $scope.overlaymessage = true;
            setTimeout(function () {
                window.location.reload();
            }, 8000)
        }


    }]);


