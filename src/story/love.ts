import type { StoryFile } from './types';

export const loveStory: StoryFile = {
  "start": "Intro",
  "nodes": {
    "Intro": {
      "id": "Intro",
      "speaker": "Vinesh",
      "text": "Hi Kishahnica, this is Vinesh! My friend Natalia gave me your number.",
      "video": "/video/vinesh-waving.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "You have a really great friend in Natalia.",
          "next": "Suggestion"
        },
        {
          "kind": "simple",
          "label": "I saw how much we had in common from her presentation!",
          "next": "Suggestion"
        },
        {
          "kind": "check",
          "label": "Bold of you to text me.",
          "skill": "Intimidation",
          "dc": 15,
          "modifier": 2,
          "onSuccess": "Bold",
          "onFailure": "Suggestion"
        },
        {
          "kind": "check",
          "label": "(Ghost him.)",
          "skill": "Stealth",
          "dc": 10,
          "modifier": 2,
          "onSuccess": "Reminder",
          "onFailure": "Suggestion"
        }
      ]
    },
    "Reminder": {
      "id": "Reminder",
      "speaker": "Vinesh",
      "text": "Hey Kishahnica, just following up and see if you want to explore this TikTok romance :)",
      "video": "/video/vinesh-thinking.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "You know what? It's the summer of hopeium!",
          "next": "Suggestion"
        },
        {
          "kind": "check",
          "label": "(Ghost him again.)",
          "skill": "Stealth",
          "dc": 5,
          "modifier": 2,
          "onSuccess": "LastTry",
          "onFailure": "Suggestion"
        }
      ]
    },
    "LastTry": {
      "id": "LastTry",
      "speaker": "Vinesh",
      "text": "Hi Kishahnica, we have been trying to reach you about your car's extended warranty… err, about the potential love of your life, Vinesh.",
      "video": "/video/vinesh-knocking.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "Okay wise guy, suggest a date!",
          "next": "Suggestion"
        },
        {
          "kind": "check",
          "label": "(Keep ghosting him.)",
          "skill": "Stealth",
          "dc": 5,
          "modifier": 2,
          "onSuccess": "Natalia",
          "onFailure": "Suggestion"
        }
      ]
    },
    "Natalia": {
      "id": "Natalia",
      "speaker": "Natalia",
      "text": "Hey Kishahnica, this is your good friend Natalia. I just wanted to say, you should really give my other friend Vinesh a chance!",
      "video": "/video/natalia-greeting.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "Sorry, I was so busy! Let me text him back.",
          "next": "Intro"
        },
        {
          "kind": "simple",
          "label": "Tell him to suggest a date!",
          "next": "Suggestion"
        }
      ]
    },
    "Suggestion": {
      "id": "Suggestion",
      "speaker": "Vinesh",
      "text": "I'd love to meet you! I'm out of town right now, but would you be interested in getting coffee/tea and going for a walk one day?",
      "video": "/video/vinesh-offering.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "Let's do it :). When are you free?",
          "next": "SaturdayAsk"
        },
        {
          "kind": "simple",
          "label": "I go into work five days a week so I would be free August 2nd.",
          "next": "SaturdayRespond"
        },
        {
          "kind": "check",
          "label": "What are you traveling for?",
          "skill": "Insight",
          "dc": 10,
          "modifier": 3,
          "onSuccess": "FamilyChicago",
          "onFailure": "SaturdayAsk"
        },
        {
          "kind": "check",
          "label": "Out of town? Pfft. Text me when you're serious.",
          "skill": "Intimidation",
          "dc": 10,
          "modifier": 2,
          "onSuccess": "FamilyChicago",
          "onFailure": "SaturdayAsk"
        }
      ]
    },
    "SaturdayAsk": {
      "id": "SaturdayAsk",
      "speaker": "Vinesh",
      "text": "Are you free Saturday, August 2nd? Do you want to get coffee at the Emerald Lounge and then walk to Lafayette Park?",
      "video": "/video/vinesh-offering.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "I haven't been to the emerald lounge yet so that sounds great!",
          "next": "Time"
        },
        {
          "kind": "simple",
          "label": "I have been to Lafayette Park with my dog Bumi but always happy to go there.",
          "next": "Bumi"
        }
      ]
    },
    "SaturdayRespond": {
      "id": "SaturdayRespond",
      "speaker": "Vinesh",
      "text": "August 2nd is perfect. Do you want to get coffee at the Emerald Lounge and then walk to Lafayette Park?",
      "video": "/video/vinesh-offering.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "I haven't been to the emerald lounge yet so that sounds great!",
          "next": "Time"
        },
        {
          "kind": "simple",
          "label": "I have been to Lafayette Park with my dog Bumi but always happy to go there.",
          "next": "Bumi"
        }
      ]
    },
    "FamilyChicago": {
      "id": "FamilyChicago",
      "speaker": "Vinesh",
      "text": "I'm visiting my parents and brother in Chicago, but I'll be back 7/29.",
      "video": "/video/vinesh-talking.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "I would be down to go for a walk and get coffee when you are back in town.",
          "next": "SaturdayAsk"
        },
        {
          "kind": "simple",
          "label": "I actually just got back from visiting my family in the Midwest this past Sunday :).",
          "next": "FamilyNebraska"
        },
        {
          "kind": "simple",
          "label": "My best friend from college is actually from Skokie, which I believe is a suburb of Chicago.",
          "next": "Skokie"
        },
        {
          "kind": "simple",
          "label": "Before any Indian stores opened up in Nebraska, my family would make the 8 hour drive to Devon street to stock up.",
          "next": "Devon"
        }
      ]
    },
    "Bold": {
      "id": "Bold",
      "speaker": "Vinesh",
      "text": "Italics of you to text me back…",
      "video": "/video/vinesh-laughing.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "(Don't acknowledge it.)",
          "next": "Suggestion"
        },
        {
          "kind": "simple",
          "label": "(Send a laugh reaction.)",
          "next": "Suggestion"
        }
      ]
    },
    "FamilyNebraska": {
      "id": "FamilyNebraska",
      "speaker": "Vinesh",
      "text": "Yay, I'm so glad you got to spend time with your family! I lived in Omaha for about six months and my friend was in school in Lincoln so I do have some good memories from Nebraska.",
      "video": "/video/vinesh-talking.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "That's amazing! Yeah I grew up in Lincoln. Loved growing up there!",
          "next": "Lincoln"
        },
        {
          "kind": "simple",
          "label": "What a coincidence that you used to live in NE! That's crazy. Were you working there for 6 months?",
          "next": "Omaha"
        }
      ]
    },
    "Lincoln": {
      "id": "Lincoln",
      "speaker": "Vinesh",
      "text": "What were your favorite things about Lincoln?",
      "video": "/video/vinesh-asking.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "The sunsets for sure!!",
          "next": "SaturdayAsk"
        },
        {
          "kind": "check",
          "label": "(Tell him about your nacho crawl, which was epic.)",
          "skill": "Performance",
          "dc": 10,
          "modifier": 2,
          "onSuccess": "Crawl",
          "onFailure": "SaturdayAsk"
        },
        {
          "kind": "simple",
          "label": "I also loved going to college football games in Lincoln with my dad and sister.",
          "next": "Football"
        },
        {
          "kind": "check",
          "label": "What about you? What are your favorite things to do or see in Chicago?",
          "skill": "Insight",
          "dc": 5,
          "modifier": 3,
          "onSuccess": "Chicago",
          "onFailure": "SaturdayAsk"
        }
      ]
    },
    "Omaha": {
      "id": "Omaha",
      "speaker": "Vinesh",
      "text": "Yeah! My friend and I got into a startup accelerator in Omaha. We lived in a startup house with a bunch of other founders.",
      "video": "/video/vinesh-talking.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "(No response.)",
          "next": "SaturdayAsk"
        },
        {
          "kind": "check",
          "label": "What did you get up to in Omaha?",
          "skill": "History",
          "dc": 5,
          "modifier": 4,
          "onSuccess": "Tacos",
          "onFailure": "SaturdayAsk"
        }
      ]
    },
    "Tacos": {
      "id": "Tacos",
      "speaker": "Vinesh",
      "text": "We used to do this taco night ride every Thursday LOL biking with 50 other people from Omaha to Iowa to this taco shack in the middle of nowhere and biking back in the middle of the night.",
      "video": "/video/vinesh-laughing.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "That taco ride thing sounds fun! I haven't heard of it.",
          "next": "SaturdayAsk"
        },
        {
          "kind": "simple",
          "label": "Are you free August 2nd?",
          "next": "SaturdayRespond"
        }
      ]
    },
    "Crawl": {
      "id": "Crawl",
      "speaker": "Vinesh",
      "text": "Aww that sounds like so much fun! I love a non-bar-crawl crawl.",
      "video": "/video/vinesh-talking.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "(No response.)",
          "next": "Tacos"
        },
        {
          "kind": "simple",
          "label": "So where are we going together?",
          "next": "SaturdayAsk"
        }
      ]
    },
    "Football": {
      "id": "Football",
      "speaker": "Vinesh",
      "text": "I never got to go to a game but we went to Lincoln on game day and the sea of red jerseys all over town was so cool.",
      "video": "/video/vinesh-talking.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "(No response.)",
          "next": "SaturdayAsk"
        },
        {
          "kind": "simple",
          "label": "I am free August 2nd if that works for you!",
          "next": "SaturdayRespond"
        }
      ]
    },
    "Chicago": {
      "id": "Chicago",
      "speaker": "Vinesh",
      "text": "I love riding the L in Chicago, or walking along the Lakeshore. I also really like malls haha and there's a Burmese restaurant in the suburbs that is even better than what I've had in SF.",
      "video": "/video/vinesh-thinking.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "Yeah some of my family members have been to Burma love in SF and they weren't huge fans of it.",
          "next": "Burmese"
        },
        {
          "kind": "simple",
          "label": "I feel like malls are disappearing now and I saw a video of a completely empty mall with just a bath and body works in it and that's it!",
          "next": "SaturdayAsk"
        }
      ]
    },
    "Burmese": {
      "id": "Burmese",
      "speaker": "Vinesh",
      "text": "There's also a Burmese place in Mission called Yamo that's cash only and really good. It's run by a mother/daughter pair and they yell at all the customers haha",
      "video": "/video/vinesh-talking.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "I actually haven't tried any Burmese food yet.",
          "next": "Foreshadowing"
        },
        {
          "kind": "simple",
          "label": "I love places like that where it is a small business and it feels like you are apart of the family!",
          "next": "Yelled"
        },
        {
          "kind": "simple",
          "label": "(Send a laugh reaction.)",
          "next": "SaturdayAsk"
        }
      ]
    },
    "Foreshadowing": {
      "id": "Foreshadowing",
      "speaker": "Vinesh",
      "text": "I'll take you there some day :)",
      "video": "/video/vinesh-offering.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "That would be nice :).",
          "next": "SaturdayAsk"
        },
        {
          "kind": "check",
          "label": "(Is he foreshadowing??)",
          "skill": "Arcana",
          "dc": 20,
          "modifier": 5,
          "onSuccess": "Future",
          "onFailure": "SaturdayAsk"
        }
      ]
    },
    "Yelled": {
      "id": "Yelled",
      "speaker": "Vinesh",
      "text": "Totally agree, being yelled at is what really completes the experience of a home-cooked meal for me",
      "video": "/video/vinesh-laughing.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "Yeah if you are not paying with your mental health it hits different.",
          "next": "SaturdayAsk"
        },
        {
          "kind": "simple",
          "label": "It's not home.",
          "next": "SaturdayAsk"
        }
      ]
    },
    "Future": {
      "id": "Future",
      "speaker": "Future Kishahnica",
      "text": "He will indeed take you to Yamo. Almost exactly a year from now.",
      "video": "/video/yamo-looping.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "Holy shit!",
          "next": "SaturdayAsk"
        },
        {
          "kind": "simple",
          "label": "I want to go to there.",
          "next": "SaturdayAsk"
        }
      ]
    },
    "Skokie": {
      "id": "Skokie",
      "speaker": "Vinesh",
      "text": "I know Skokie! My mom worked for a candy company there for many years and I used to tag along.",
      "video": "/video/vinesh-talking.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "(No response.)",
          "next": "SaturdayAsk"
        },
        {
          "kind": "simple",
          "label": "I'd love to tag along with you. How about August 2nd?",
          "next": "SaturdayRespond"
        }
      ]
    },
    "Devon": {
      "id": "Devon",
      "speaker": "Vinesh",
      "text": "Whoa that's metal. I love Devon! That's commitment to the culture.",
      "video": "/video/vinesh-talking.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "(No response.)",
          "next": "SaturdayAsk"
        },
        {
          "kind": "simple",
          "label": "So where are we going to go? I am free August 2nd.",
          "next": "SaturdayRespond"
        }
      ]
    },
    "Time": {
      "id": "Time",
      "speaker": "Vinesh",
      "text": "Want to do 2pm on 8/2 at Emerald Lounge? I can do morning too if you prefer.",
      "video": "/video/vinesh-offering.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "Yeah! 2pm sounds great!",
          "next": "End"
        },
        {
          "kind": "check",
          "label": "I'm actually a morning person. Can you do 7am?",
          "skill": "Deception",
          "dc": 15,
          "modifier": -1,
          "onSuccess": "YesMorning",
          "onFailure": "NoMorning"
        }
      ]
    },
    "Bumi": {
      "id": "Bumi",
      "speaker": "Vinesh",
      "text": "Do you want to bring Bumi? :D",
      "video": "/video/vinesh-offering.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "Haha Bumi is a lil high energy kind of like her namesake king Bumi.",
          "next": "Time"
        },
        {
          "kind": "simple",
          "label": "I think she will sit this walk out lol.",
          "next": "Time"
        },
        {
          "kind": "simple",
          "label": "She's a crotch jumper. I don't want to hurt you.",
          "next": "Time"
        },
        {
          "kind": "check",
          "label": "Yeah! I'll bring her :).",
          "skill": "Animal Handling",
          "dc": 20,
          "modifier": 10,
          "onSuccess": "CombatBegins",
          "onFailure": "Time"
        }
      ]
    },
    "BumiAdvantage": {
      "id": "BumiAdvantage",
      "speaker": "Bumi",
      "text": "[Started combat with advantage.]",
      "video": "/video/bumi-attacking.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "(Let Bumi attack his crotch.)",
          "next": "BumiAttacked"
        },
        {
          "kind": "check",
          "label": "(Warn him to turn around.)",
          "skill": "Survival",
          "dc": 10,
          "modifier": 3,
          "onSuccess": "BumiSafe",
          "onFailure": "BumiAttacked"
        }
      ]
    },
    "BumiDisadvantage": {
      "id": "BumiDisadvantage",
      "speaker": "Bumi",
      "text": "[Opponent is alert. Bumi is ready to attack.]",
      "video": "/video/bumi-attacking.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "(Warn him to turn around.)",
          "next": "BumiSafe"
        },
        {
          "kind": "check",
          "label": "(Hold Bumi back.)",
          "skill": "Athletics",
          "dc": 10,
          "modifier": -3,
          "onSuccess": "BumiPet",
          "onFailure": "BumiAttacked"
        }
      ]
    },
    "BumiAttacked": {
      "id": "BumiAttacked",
      "speaker": "Bumi",
      "text": "[Vinesh was injured, but he's looking forward to the next date. -10 health.]",
      "video": "/video/bumi-laying.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "Good girl, Bumi!",
          "next": "End"
        },
        {
          "kind": "simple",
          "label": "I love you, Bumi!",
          "next": "End"
        },
        {
          "kind": "simple",
          "label": "You're so cute, Bumi!",
          "next": "End"
        }
      ]
    },
    "BumiSafe": {
      "id": "BumiSafe",
      "speaker": "Bumi",
      "text": "[Vinesh protected his crotch in time. -2 health.]",
      "video": "/video/bumi-laying.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "Good girl, Bumi!",
          "next": "End"
        },
        {
          "kind": "simple",
          "label": "I love you, Bumi!",
          "next": "End"
        },
        {
          "kind": "simple",
          "label": "You're so cute, Bumi!",
          "next": "End"
        }
      ]
    },
    "BumiPet": {
      "id": "BumiPet",
      "speaker": "Bumi",
      "text": "[Vinesh gave Bumi scritches. +5 relationship points.]",
      "video": "/video/bumi-laying.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "Good girl, Bumi!",
          "next": "End"
        },
        {
          "kind": "simple",
          "label": "I love you, Bumi!",
          "next": "End"
        },
        {
          "kind": "simple",
          "label": "You're so cute, Bumi!",
          "next": "End"
        }
      ]
    },
    "YesMorning": {
      "id": "YesMorning",
      "speaker": "Vinesh",
      "text": "7am is perfect. I used to be a morning person in high school, so I can summon that for you :)",
      "video": "/video/vinesh-talking.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "See you there! At 7am.",
          "next": "End"
        },
        {
          "kind": "simple",
          "label": "Just kidding, let's do 2pm.",
          "next": "End"
        }
      ]
    },
    "NoMorning": {
      "id": "NoMorning",
      "speaker": "Vinesh",
      "text": "That's hilarious. I'll see you at 2pm :)",
      "video": "/video/vinesh-laughing.mp4",
      "choices": [
        {
          "kind": "simple",
          "label": "Yeah you already know me. See you then :).",
          "next": "End"
        },
        {
          "kind": "simple",
          "label": "Oh good, you're also a night owl.",
          "next": "End"
        }
      ]
    },
    "End": {
      "id": "End",
      "speaker": "Vinesh",
      "text": "And that is the story of how we set up our first date. Happy anniversary, Kishahnica. I love you in every timeline.",
      "video": "/video/vinesh-waving.mp4",
      "choices": []
    },
    "CombatBegins": {
      "id": "CombatBegins",
      "speaker": "Vinesh",
      "text": "Narrator: [Bumi is ready for combat.]",
      "video": "/video/vinesh-thinking.mp4",
      "choices": [
        {
          "kind": "check",
          "label": "(Roll for initiative.)",
          "skill": "Acrobatics",
          "dc": 10,
          "modifier": -2,
          "onSuccess": "BumiAdvantage",
          "onFailure": "BumiDisadvantage"
        }
      ]
    }
  }
};
