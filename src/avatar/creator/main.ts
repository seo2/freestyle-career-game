// Entry point for the standalone Creador de Avatar page (avatar.html).
//
// Standalone on purpose: the creator is a web UI with real type and hard borders,
// and the game is a Phaser canvas. Building it as its own page means the avatar
// SYSTEM can be proven and iterated on without disturbing the game, and the game
// can adopt the same renderAvatar() when the art is ready.

import { mountCreator } from "./index";

const root = document.getElementById("creator");
if (!root) throw new Error("falta #creator en avatar.html");
mountCreator(root);
