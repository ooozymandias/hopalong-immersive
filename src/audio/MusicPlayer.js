import { AudioBands } from './AudioBands.js';

export class MusicPlayer {
  constructor(tracks, root, baseUrl = import.meta.env.BASE_URL) {
    this.baseUrl = baseUrl;
    this.tracks = tracks;
    this.index = 0;
    this.started = false;
    this.wantPlaying = false;
    this.request = 0;
    this.disposed = false;
    this.media = new Audio();
    this.media.preload = 'none';
    this.audio = new AudioBands(this.media);
    this.abort = new AbortController();
    const options = { signal: this.abort.signal };
    this.select = root.querySelector('#track');
    this.playButton = root.querySelector('#play');
    this.message = root.querySelector('#music-status');
    this.meters = root.querySelector('#audio-values');
    this.meterTime = 0;
    this.select.replaceChildren(...tracks.map((track, index) => new Option(track.title, String(index))));
    this.playButton.addEventListener('click', () => {
      if (this.wantPlaying) this.pause(); else void this.play();
    }, options);
    this.select.addEventListener('change', () => this.choose(Number(this.select.value)), options);
    root.querySelector('#previous').addEventListener('click', () => this.choose(this.index - 1), options);
    root.querySelector('#next').addEventListener('click', () => this.choose(this.index + 1), options);
    const volume = root.querySelector('#volume');
    volume.value = String(this.audio.volume);
    volume.addEventListener('input', () => this.audio.setVolume(Number(volume.value)), options);
    this.media.addEventListener('playing', () => {
      if (!this.wantPlaying) { this.media.pause(); return; }
      this.audio.fadeIn();
      this.message.textContent = `Lecture : ${this.tracks[this.index].title}`;
      this.sync();
    }, options);
    this.media.addEventListener('waiting', () => {
      if (this.wantPlaying) this.message.textContent = 'Chargement du morceau…';
    }, options);
    this.media.addEventListener('ended', () => this.choose(this.index + 1, true), options);
    this.media.addEventListener('error', () => {
      this.request++;
      this.wantPlaying = false;
      this.message.textContent = 'Morceau indisponible ou format non pris en charge. Choisissez un autre morceau.';
      this.sync();
    }, options);
    for (const input of root.querySelectorAll('button, select, input')) input.disabled = !tracks.length;
    root.querySelector('#previous').disabled = tracks.length < 2;
    root.querySelector('#next').disabled = tracks.length < 2;
    this.message.textContent = tracks.length
      ? 'La musique démarrera uniquement avec Démarrer ou Enter VR.'
      : 'Aucun MP3 ou OGG dans public/music/.';
    if (tracks.length) this.setSource();
    this.sync();
  }

  setSource() {
    this.audio.beats.reset(true);
    this.select.value = String(this.index);
    this.media.src = this.baseUrl + 'music/' + encodeURIComponent(this.tracks[this.index].file);
  }

  sync() {
    this.playButton.textContent = this.wantPlaying ? 'Pause' : this.started ? 'Play' : 'Démarrer avec la musique';
    this.playButton.setAttribute('aria-pressed', String(this.wantPlaying));
  }

  async play() {
    if (!this.tracks.length || this.disposed) return;
    this.started = true;
    this.wantPlaying = true;
    const request = ++this.request;
    this.sync();
    this.message.textContent = 'Chargement du morceau…';
    try {
      // Both calls happen in the original user gesture, without an intervening await.
      const resume = this.audio.activate();
      const playback = this.media.play();
      await Promise.all([resume, playback]);
    } catch (error) {
      if (request !== this.request || this.disposed) return;
      this.media.pause();
      this.wantPlaying = false;
      this.message.textContent = error.name === 'NotAllowedError'
        ? 'Lecture bloquée par le navigateur. Cliquez sur Play pour réessayer.'
        : 'Lecture impossible. Réessayez ou choisissez un autre morceau.';
      this.sync();
    }
  }

  pause() {
    this.request++;
    this.wantPlaying = false;
    this.media.pause();
    this.message.textContent = 'Musique en pause.';
    this.sync();
  }

  choose(index, continuePlaying = this.wantPlaying) {
    if (!this.tracks.length) return;
    this.pause();
    this.index = (index + this.tracks.length) % this.tracks.length;
    this.setSource();
    this.message.textContent = 'Morceau sélectionné. Cliquez sur Play pour écouter.';
    if (continuePlaying) void this.play();
  }

  startFromGesture() {
    // Entering VR again must not override an intentional pause.
    if (!this.started) void this.play();
  }

  update(delta, showMeters) {
    const bands = this.audio.update(delta);
    this.meterTime += delta;
    if (showMeters && this.meterTime >= 0.1) {
      this.meterTime = 0;
      this.meters.textContent = `Bass ${bands.bass.toFixed(2)} · Mid ${bands.mid.toFixed(2)} · Treble ${bands.treble.toFixed(2)} · Énergie ${bands.energy.toFixed(2)} · Beat ${bands.beat.toFixed(2)}`;
    }
    return bands;
  }

  dispose() {
    this.disposed = true;
    this.request++;
    this.abort.abort();
    this.media.pause();
    this.media.removeAttribute('src');
    this.media.load();
    this.audio.dispose();
  }
}
