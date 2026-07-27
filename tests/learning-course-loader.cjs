'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function readRequired(relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) {
    throw new Error(`Required learning file is missing: ${relativePath}`);
  }
  return fs.readFileSync(file, 'utf8');
}

function loadLearningCourse() {
  const sandbox = { window: {}, module: { exports: {} }, exports: {} };
  vm.createContext(sandbox, {
    name: 'PokerPilot learning course data sandbox',
    codeGeneration: { strings: false, wasm: false }
  });
  new vm.Script(readRequired('src/data/learning-course.js'), {
    filename: 'src/data/learning-course.js'
  }).runInContext(sandbox, { timeout: 2_000 });
  return sandbox.window.POKERPILOT_COURSE || sandbox.module.exports;
}

function loadCourseProgress() {
  const course = loadLearningCourse();
  const sandbox = {
    window: { POKERPILOT_COURSE: course },
    module: { exports: {} },
    exports: {}
  };
  vm.createContext(sandbox, {
    name: 'PokerPilot learning progress sandbox',
    codeGeneration: { strings: false, wasm: false }
  });
  new vm.Script(readRequired('src/learning/course-progress.js'), {
    filename: 'src/learning/course-progress.js'
  }).runInContext(sandbox, { timeout: 2_000 });
  return {
    course,
    api: sandbox.window.CourseProgress || sandbox.module.exports
  };
}

function loadLearningMode() {
  const { course, api: progressApi } = loadCourseProgress();
  const sandbox = {
    window: {
      POKERPILOT_COURSE: course,
      CourseProgress: progressApi
    },
    module: { exports: {} },
    exports: {}
  };
  vm.createContext(sandbox, {
    name: 'PokerPilot learning UI sandbox',
    codeGeneration: { strings: false, wasm: false }
  });
  new vm.Script(readRequired('src/ui/learning-mode.js'), {
    filename: 'src/ui/learning-mode.js'
  }).runInContext(sandbox, { timeout: 2_000 });
  return sandbox.window.LearningMode || sandbox.module.exports;
}

module.exports = {
  loadLearningCourse,
  loadCourseProgress,
  loadLearningMode,
  readRequired
};
