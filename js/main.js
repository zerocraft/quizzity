/*jslint browser: true, nomen: true, white: true, vars: true, todo: true*/
/*global $*/
/*global _*/
/*global L*/

'use strict';

L.AwesomeMarkers.Icon.prototype.options.prefix = 'fa';

var Icons = {
    guess: L.AwesomeMarkers.icon({
        icon: 'question-circle',
        markerColor: 'orange'
    }),
    city: L.AwesomeMarkers.icon({
        icon: 'check',
        markerColor: 'green'
    })
};

var Quizzity = function() {
    this.cities = []; // cities to guess
    this.markers = []; // map elements

    // Set up the map and tiles
    this.map = L.map('map', {
        doubleClickZoom: false
    });

    this.layer = L.tileLayer('https://{s}.tiles.mapbox.com/v3/{id}/{z}/{x}/{y}.png', {
        id: 'sharkdp.e01ecf2e',
        maxZoom: Quizzity.maxZoom,
        minZoom: Quizzity.minZoom,
        noWrap: true
    }).addTo(this.map);

    // Initial view
    this.map.fitWorld();
    this.map.panTo(Quizzity.mapCenter);

    // Register events
    this.map.on('click', _.bind(this.userClick, this));
    $("#start").click(_.bind(this.newGame, this));

    // HTML elements
    this.dialog = $("#dialog");
    this.panel = $("#panel");
};

Quizzity.minZoom = 2;
Quizzity.maxZoom = 5;
Quizzity.mapCenter = L.latLng(50, 10); // usually a bad idea: a german-based worldview

Quizzity.citiesPerGame = 3;

Quizzity.prototype.currentCity = function() {
    return this.cities[this.pointer];
};

Quizzity.prototype.showCity = function() {
    var prefix = '<i class="fa fa-location-arrow"></i> ';
    this.panel.html(prefix + this.currentCity().fullName);

    this.startTime = new Date().getTime();
};

Quizzity.prototype.newGame = function() {
    this.removeMarkers();

    // Select random cities and add information
    this.cities = _(this.dbCities)
        .sample(Quizzity.citiesPerGame)
        .map(function(city) {
            // Replace country code by country name
            city.country = this.dbCountries[city.country].name;

            city.fullName = decodeURIComponent(city.name) + ", " +
                            decodeURIComponent(city.country);

            city.position = L.latLng(city.lat, city.lng);
            return city;
        }, this)
        .value();

    this.pointer = 0;

    this.showCity();

    this.dialog.hide();
    this.panel.slideDown(200);
};

Quizzity.prototype.showPoints = function() {
    this.panel.slideUp(200);

    // Show all markers
    _.each(this.cities, function(city) {
        this.showMarkers(city, true);
    }, this);

    // TODO: Allow user to zoom in, maybe show a different map with labels

    // Score
    var score = _.reduce(this.cities, function(sum, city) {
        return sum + city.points;
    }, 0);

    // Average, best and worst distance:
    var avgdist = Math.round(_.reduce(this.cities, function(sum, city) {
        return sum + city.distance;
    }, 0) / Quizzity.citiesPerGame);

    var sorted = _.sortBy(this.cities, 'distance');
    var bestcity = _.first(sorted);

    var text = '<ul class="fa-ul">';
    text += '<li><i class="fa-li fa fa-area-chart"></i>Average distance: ' + avgdist.toString() + 'km</li>';
    text += '<li><i class="fa-li fa fa-thumbs-o-up"></i>Best guess:<br>' + bestcity.distance.toString() + 'km (' + bestcity.fullName + ')</li>';
    text += '</ul>';

    // TODO: highscore?

    $("#dialogTitle").html(score.toString() + " points!");
    $("#dialogContent").html(text);
    $("#dialogLabel").html("Try again!");

    this.dialog.fadeIn();
};

Quizzity.prototype.gameActive = function() {
    return !_.isEmpty(this.cities) && this.pointer < Quizzity.citiesPerGame;
};

Quizzity.prototype.removeMarkers = function() {
    if (!_.isUndefined(this.markers)) {
        _.each(this.markers, function(m) {
            this.map.removeLayer(m);
        }, this);
    }
};

Quizzity.prototype.showMarkers = function(city, drawLine) {
    this.markers.push(
        L.marker(city.position, {
            icon: Icons.city,
            clickable: false,
            keyboard: false,
            title: city.fullName
        }).addTo(this.map)
    );

    this.markers.push(
        L.marker(city.guess, {
            icon: Icons.guess,
            clickable: false,
            keyboard: false
        }).addTo(this.map)
    );

    if (drawLine) {
        this.markers.push(
            L.polyline([city.guess, city.position], {
                color: 'black',
                weight: 3,
                opacity: 0.6,
                clickable: false
            }).addTo(this.map)
        );
    }
};

Quizzity.prototype.userClick = function(e) {
    if (!this.gameActive()) {
        return;
    }

    var time = (new Date().getTime()) - this.startTime;

    var city = this.currentCity();
    city.guess = e.latlng;

    // Calculate points
    var points = 0;

    // Distance in kilometers
    var dist = Math.round(city.guess.distanceTo(city.position) / 1000);

    if (dist < 15) { // Consider this exact
        points = 2000;
    } else if (dist < 1500) {
        points = 1500 - dist;
    }

    var multiplier = 1;
    if (time < 1000) {
        multiplier = 3;
    } else if (time < 2000) {
        multiplier = 2;
    } else if (time < 3000) {
        multiplier = 1.5;
    } else if (time < 5000) {
        multiplier = 1.2;
    }

    points *= multiplier;
    points = Math.round(points);

    // Save for stats
    city.distance = dist;
    city.points = points;
    city.time = time;

    // Reset map view
    this.map.setView(Quizzity.mapCenter, Quizzity.minZoom, {
        animation: true,
    });

    this.pointer += 1;
    if (this.gameActive()) {
        // Show guess and solution on the map
        this.removeMarkers();
        this.showMarkers(city, false);

        // Show next city in panel
        this.showCity();
    } else {
        // Game over!
        this.showPoints();
    }

    return true;
};


$(document).ready(function() {
    var quizzity = new Quizzity();

    // Load JSON data (countries and cities)
    $.getJSON("geodata/countries.json").success(function(countries) {
        quizzity.dbCountries = countries;

        $.getJSON("geodata/cities.json", function(cities) {
            quizzity.dbCities = cities;

            // TODO: feedback that json has loaded
        });
    });
});
