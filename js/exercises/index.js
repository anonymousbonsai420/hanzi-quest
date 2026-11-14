// Registro dos tipos de exercício: tipo (usado pelo builder.js) → função.
// Cada função recebe (stage, ex, io) e resolve com { correct, skipped?, intro?, answer?: html, note?: html }.
import { introExercise } from './intro.js';
import { meaningExercise, hanziExercise } from './meaning.js';
import { listenExercise } from './listen.js';
import { pinyinExercise } from './pinyin.js';
import { speakExercise } from './speak.js';
import { writeExercise } from './write.js';
import { buildExercise } from './build.js';
import { matchExercise } from './match.js';
import { toneExercise } from './tone.js';

export const EXERCISES = {
  intro: introExercise,
  mc_meaning: meaningExercise,
  mc_hanzi: hanziExercise,
  listen: listenExercise,
  pinyin: pinyinExercise,
  speak: speakExercise,
  write: writeExercise,
  build: buildExercise,
  match: matchExercise,
  tone: toneExercise,
};
