import type { StoryFile } from './types';

// The sample story: a night-gate encounter with Warden Aldric.
//
//                         ┌─────────┐
//                         │  gate   │ (start)
//                         └────┬────┘
//         truth ◄──simple──────┤
//     persuaded ◄──check pass──┤  Persuasion DC 12 (+3)
//    suspicious ◄──check fail──┤
//       bluffed ◄──check pass──┤  Deception  DC 15 (+1)
//        caught ◄──check fail──┤
//         leave ◄──simple──────┘
//
//   truth/persuaded/bluffed ──► enter (ending)
//   suspicious ──► truth | leave      caught ──► truth | leave
//   enter, leave = terminal nodes (choices: [])
//
// video: "" everywhere for now — the UI renders the ambient placeholder.
// Drop real clips into public/video/ and set the path to swap them in.
export const sampleStory: StoryFile = {
  "start": "gate",
  "nodes": {
    "gate": {
      "id": "gate",
      "speaker": "Gate Warden Aldric",
      "text": "Halt. The city's closed after dark, and you don't look like anyone I'm meant to let through. State your business.",
      "video": "",
      "choices": [
        {
          "kind": "simple",
          "label": "Tell him the truth. You seek the archivist.",
          "next": "truth"
        },
        {
          "kind": "check",
          "label": "Convince him you mean no harm.",
          "skill": "Persuasion",
          "dc": 12,
          "modifier": 3,
          "onSuccess": "persuaded",
          "onFailure": "suspicious"
        },
        {
          "kind": "check",
          "label": "Lie. Claim you carry a sealed writ.",
          "skill": "Deception",
          "dc": 15,
          "modifier": 1,
          "onSuccess": "bluffed",
          "onFailure": "caught"
        },
        {
          "kind": "simple",
          "label": "Say nothing and turn to leave.",
          "next": "leave"
        }
      ]
    },
    "truth": {
      "id": "truth",
      "speaker": "Gate Warden Aldric",
      "text": "The archivist, eh? Odd hour for old books. ...Fine. Honesty buys you a step. But I'll be watching.",
      "video": "",
      "choices": [
        {
          "kind": "simple",
          "label": "Thank him and enter.",
          "next": "enter"
        }
      ]
    },
    "persuaded": {
      "id": "persuaded",
      "speaker": "Gate Warden Aldric",
      "text": "Hah. You've an honest face, I'll give you that. Go on through, before I change my mind.",
      "video": "",
      "choices": [
        {
          "kind": "simple",
          "label": "Slip inside.",
          "next": "enter"
        }
      ]
    },
    "suspicious": {
      "id": "suspicious",
      "speaker": "Gate Warden Aldric",
      "text": "Nice words. I've heard prettier from worse men. Stand where I can see your hands.",
      "video": "",
      "choices": [
        {
          "kind": "simple",
          "label": "Comply, then try the truth.",
          "next": "truth"
        },
        {
          "kind": "simple",
          "label": "Back off for now.",
          "next": "leave"
        }
      ]
    },
    "bluffed": {
      "id": "bluffed",
      "speaker": "Gate Warden Aldric",
      "text": "A sealed writ. Of course. ...Go on, then. Don't make me regret not reading it.",
      "video": "",
      "choices": [
        {
          "kind": "simple",
          "label": "Walk through, heart pounding.",
          "next": "enter"
        }
      ]
    },
    "caught": {
      "id": "caught",
      "speaker": "Gate Warden Aldric",
      "text": "There's no writ. I can smell a lie through three feet of oak. Turn around.",
      "video": "",
      "choices": [
        {
          "kind": "simple",
          "label": "Drop the act and tell the truth.",
          "next": "truth"
        },
        {
          "kind": "simple",
          "label": "Leave before this gets worse.",
          "next": "leave"
        }
      ]
    },
    "enter": {
      "id": "enter",
      "speaker": "Narrator",
      "text": "The gate groans open. Lantern-light spills across wet cobblestones, and the archive tower waits beyond.",
      "video": "",
      "choices": []
    },
    "leave": {
      "id": "leave",
      "speaker": "Narrator",
      "text": "You melt back into the dark. The gate stays shut. Some other night, perhaps.",
      "video": "",
      "choices": []
    }
  },
  "skillModifiers": {
    "Deception": 1,
    "Persuasion": 3
  }
};
