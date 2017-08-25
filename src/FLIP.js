// Once FLIP has been added to npm, this will be a simpler import. 
// See open issue: https://github.com/GoogleChrome/flipjs/issues/11

// I've also decided to build FLIP w/out GSAP support
import Core from 'FLIP/src/core';
import rAF from 'FLIP/src/raf';

Core.extend('rAF', rAF);

export default Core;