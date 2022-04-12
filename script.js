'use strict';

const { reject } = require("lodash-es");
const { remove } = require("lodash-es");

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;
  // mainWeather;
  // description;
  // iconWeather;

  constructor(coords, distance, duration) {
    // this.date = ...
    // this.id = ...
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${months[this.date.getMonth()]
      } ${this.date.getDate()}`;
  }

  _setCountries() {
    const [lat, lng] = this.coords;
    this._getJSON(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en
        `, 'Country not found!')
      .then(data => {
        this.Subdivision = data.principalSubdivision;
        this.countryName = data.countryName;
      })
      .catch(err => console.log(`${err.message} 💥`));
  };

  _setWeathers() {
    const API_key = `1c2988f2ebd12d5a7aae886c047e532c`;
    const [lat, lon] = this.coords;
    const dataWeather = async function (e) {
      return await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_key}`).then(res => res.json())
        .then(data => {

          return data.weather[0]
        })
        .then(dataW => {
          console.log(dataW);
          this.mainWeather = dataW.main;
          this.descriptionWeather = dataW.description;
          this.iconWeather = dataW.icon;
        })
        .catch(err => console.log(err.message));
    }
    dataWeather()

  }

  _getJSON(url, errorMsg = 'Something went wrong') {
    return fetch(url).then(response => {
      if (!response) throw new console.error(`${errorMsg} (${response.status})`);
      return response.json();
    })
  }

  click() {
    this.clicks++;
  }
};

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
    this._setCountries();
    this._setWeathers();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    // this.type = 'cycling';
    this.calcSpeed();
    this._setDescription();
    this._setCountries();
    this._setWeathers();

  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}



// const run1 = new Running([39, -12], 5.2, 24, 178);
// const cycling1 = new Cycling([39, -12], 27, 95, 523);
// console.log(run1, cycling1);

///////////////////////////////////////
// APPLICATION ARCHITECTURE
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

const logo = document.querySelector('.logo');
const btnReset = document.querySelector('.btn__reset');
const btnRemove = document.querySelector('.btn__remove');
const btnPosCurrent = document.querySelector('.btn__position--current');
// const btnCountry = document.querySelector('.btn__country');


class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #data;
  #markerT = [];
  #indexWorkout = [];
  #workoutEl = [];
  #coords = [];
  #yourPlace = [];

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    btnPosCurrent.addEventListener('click', this._getCurrentPos.bind(this), { once: true });

    //Delete a workout
    containerWorkouts.addEventListener('click', this._removeWorkout.bind(this));

    //Reset data
    btnReset.addEventListener('click', this._reset)
  }


  _getCurrentPos() {

    this.#yourPlace.push(
      L.marker(this.#coords)
        .addTo(this.#map)
        .bindPopup(
          L.popup({
            maxWidth: 250,
            minWidth: 100,
            autoClose: false,
            closeOnClick: false,
            className: `yourpos-popup`,
          })
        )
        .setPopupContent(
          `Your place!`
        )
        .openPopup());


  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {

    const { latitude } = position.coords;
    const { longitude } = position.coords;

    this.#coords = [latitude, longitude];
    this.#map = L.map('map').setView(this.#coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));
    // console.log(this.#workouts);
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }


  _hideForm() {
    // Empty inputs
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value =
      '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }



  async _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;

      // Check if data is valid
      if (
        // !Number.isFinite(distance) ||
        // !Number.isFinite(duration) ||
        // !Number.isFinite(cadence)
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }
    console.log(workout)
    //add workout to array #workouts
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();

  }



  _renderWorkoutMarker(workout) {

    this.#markerT.push(
      L.marker(workout.coords)
        .addTo(this.#map)
        .bindPopup(
          L.popup({
            maxWidth: 250,
            minWidth: 100,
            autoClose: false,
            closeOnClick: false,
            className: `${workout.type}-popup`,
          })
        )
        .setPopupContent(
          `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description} `
        )
        .openPopup()
    );
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description} in ${workout.Subdivision}, ${workout.countryName} <img href="http://openweathermap.org/img/w/${workout.iconWeather}.png"/> </h2>
        <div class="workout__details">
          <span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
      }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
      `;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>
      `;

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    // BUGFIX: When we click on a workout before the map has loaded, we get an error. But there is an easy fix:
    if (!this.#map) return;

    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    if (!workout) return;
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // using the public interface
    // workout.click();
  }



  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    this.#data = JSON.parse(localStorage.getItem('workouts'));

    if (!this.#data) return;

    this.#workouts = this.#data;
    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });

  }

  // set remove marker
  _setRemove() {

    this.#workoutEl.map(workE1 => workE1.remove());

    this.#indexWorkout.map(index => {
      this.#workouts.splice(index, 1)
      this.#map.removeLayer(this.#markerT[index]);
      return index;
    });

    //reset data
    this._setLocalStorage();

  }

  //Delete a workout
  _removeWorkout(event) {
    if (!this.#map) return;

    const workoutE1 = event.target.closest('.workout');

    if (!workoutE1 || this.#workoutEl.includes(workoutE1)) return;

    this.#workoutEl.push(workoutE1);

    this.#workoutEl.map(workE1 => workE1.style.borderColor = "red");

    const workout = this.#workouts.find(
      work => work.id === workoutE1.dataset.id
    );

    this.#indexWorkout.push(this.#workouts.indexOf(workout));

    btnRemove.addEventListener('click', this._setRemove.bind(this));

  }

  // Delete all workouts
  _reset() {

    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();

// http://openweathermap.org/img/w/${iconId}.png;