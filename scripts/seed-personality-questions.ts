import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const personalityQuestions = [
  {
    questionNumber: 1,
    category: "Life Philosophy & Values",
    questionText: "What do you believe is the most important purpose in life?",
    options: [
      "To be happy and enjoy experiences",
      "To help others and make the world better", 
      "To achieve personal success and recognition",
      "To find deep meaning and understanding",
      "To build strong relationships and connections",
      "To live authentically and be true to yourself"
    ],
    scoringWeights: {
      "A": { openness: 0.8, extroversion: 0.6, spiritual_inclination: 0.3 },
      "B": { agreeableness: 0.9, collectivism: 0.8, social_justice: 0.9 },
      "C": { extroversion: 0.7, conscientiousness: 0.8, agreeableness: 0.2 },
      "D": { spiritual_inclination: 0.9, openness: 0.8, growth_mindset: 0.7 },
      "E": { agreeableness: 0.8, collectivism: 0.7, extroversion: 0.5 },
      "F": { openness: 0.7, growth_mindset: 0.6, spiritual_inclination: 0.6 }
    }
  },
  {
    questionNumber: 2,
    category: "Life Philosophy & Values",
    questionText: "How do you view failure and setbacks?",
    options: [
      "They're opportunities to learn and grow",
      "They're temporary obstacles to overcome",
      "They're signs you need to change direction",
      "They're natural parts of life to accept",
      "They're challenges that build character",
      "They're experiences that teach humility"
    ],
    scoringWeights: {
      "A": { growth_mindset: 0.9, openness: 0.7, emotional_stability: 0.6 },
      "B": { conscientiousness: 0.7, emotional_stability: 0.8 },
      "C": { openness: 0.8, growth_mindset: 0.6, conscientiousness: 0.3 },
      "D": { emotional_stability: 0.9, spiritual_inclination: 0.6 },
      "E": { growth_mindset: 0.8, emotional_stability: 0.7, conscientiousness: 0.6 },
      "F": { agreeableness: 0.7, spiritual_inclination: 0.8, growth_mindset: 0.6 }
    }
  },
  {
    questionNumber: 3,
    category: "Life Philosophy & Values", 
    questionText: "What matters most when making important decisions?",
    options: [
      "What feels right in your heart",
      "What logic and facts suggest",
      "What will benefit the most people",
      "What aligns with your core values",
      "What has worked in the past",
      "What trusted people advise"
    ],
    scoringWeights: {
      "A": { openness: 0.7, spiritual_inclination: 0.6, emotional_stability: 0.4 },
      "B": { conscientiousness: 0.8, emotional_stability: 0.7, openness: 0.4 },
      "C": { agreeableness: 0.9, collectivism: 0.9, social_justice: 0.8 },
      "D": { spiritual_inclination: 0.8, conscientiousness: 0.7, growth_mindset: 0.6 },
      "E": { conscientiousness: 0.6, emotional_stability: 0.6, openness: 0.3 },
      "F": { agreeableness: 0.7, collectivism: 0.6, conscientiousness: 0.5 }
    }
  },
  {
    questionNumber: 4,
    category: "Social & Relationship Philosophy",
    questionText: "In relationships, you believe it's most important to:",
    options: [
      "Maintain your independence while being close",
      "Share everything and be completely open",
      "Support each other's dreams and goals",
      "Have fun and enjoy each other's company",
      "Work through problems together as a team",
      "Accept each other exactly as you are"
    ],
    scoringWeights: {
      "A": { emotional_stability: 0.7, growth_mindset: 0.6, extroversion: 0.4 },
      "B": { agreeableness: 0.8, extroversion: 0.6, emotional_stability: 0.4 },
      "C": { growth_mindset: 0.8, agreeableness: 0.7, collectivism: 0.6 },
      "D": { extroversion: 0.8, openness: 0.7, agreeableness: 0.6 },
      "E": { agreeableness: 0.9, collectivism: 0.7, conscientiousness: 0.6 },
      "F": { agreeableness: 0.8, emotional_stability: 0.7, growth_mindset: 0.3 }
    }
  },
  {
    questionNumber: 5,
    category: "Social & Relationship Philosophy",
    questionText: "How do you prefer to handle conflicts?",
    options: [
      "Address them directly and immediately",
      "Take time to cool down first, then discuss",
      "Focus on finding compromise and middle ground",
      "Try to understand the other person's perspective",
      "Avoid confrontation when possible",
      "Seek help from others to mediate"
    ],
    scoringWeights: {
      "A": { extroversion: 0.7, emotional_stability: 0.6, agreeableness: 0.3 },
      "B": { emotional_stability: 0.8, conscientiousness: 0.7, growth_mindset: 0.6 },
      "C": { agreeableness: 0.9, collectivism: 0.7, conscientiousness: 0.6 },
      "D": { agreeableness: 0.8, growth_mindset: 0.7, openness: 0.7 },
      "E": { agreeableness: 0.6, emotional_stability: 0.3, extroversion: 0.2 },
      "F": { collectivism: 0.7, agreeableness: 0.7, conscientiousness: 0.6 }
    }
  },
  {
    questionNumber: 6,
    category: "Social & Relationship Philosophy",
    questionText: "What's your view on personal growth in relationships?",
    options: [
      "People should grow together in the same direction",
      "Individual growth is more important than the relationship",
      "Growth should happen naturally without pressure",
      "Partners should actively help each other improve",
      "People don't really change, so accept who they are",
      "Growth comes from overcoming challenges together"
    ],
    scoringWeights: {
      "A": { growth_mindset: 0.8, collectivism: 0.8, agreeableness: 0.7 },
      "B": { growth_mindset: 0.6, extroversion: 0.4, collectivism: 0.2 },
      "C": { openness: 0.6, agreeableness: 0.7, conscientiousness: 0.3 },
      "D": { growth_mindset: 0.9, agreeableness: 0.8, collectivism: 0.7 },
      "E": { agreeableness: 0.7, emotional_stability: 0.6, growth_mindset: 0.2 },
      "F": { growth_mindset: 0.8, emotional_stability: 0.7, collectivism: 0.6 }
    }
  },
  {
    questionNumber: 7,
    category: "Personality & Communication Style",
    questionText: "In social situations, you typically:",
    options: [
      "Love being the center of attention and entertaining others",
      "Enjoy deep conversations with a few people",
      "Prefer to listen and observe before participating",
      "Try to make sure everyone feels included",
      "Focus on having fun and keeping things light",
      "Feel energized by meeting new people"
    ],
    scoringWeights: {
      "A": { extroversion: 0.9, openness: 0.6, agreeableness: 0.4 },
      "B": { extroversion: 0.3, openness: 0.8, spiritual_inclination: 0.7 },
      "C": { extroversion: 0.2, emotional_stability: 0.6, openness: 0.6 },
      "D": { agreeableness: 0.9, collectivism: 0.8, extroversion: 0.6 },
      "E": { extroversion: 0.7, agreeableness: 0.6, emotional_stability: 0.6 },
      "F": { extroversion: 0.9, openness: 0.8, agreeableness: 0.6 }
    }
  },
  {
    questionNumber: 8,
    category: "Personality & Communication Style",
    questionText: "When someone is upset, your first instinct is to:",
    options: [
      "Give them space to process their emotions",
      "Offer practical solutions to fix the problem",
      "Listen carefully and validate their feelings",
      "Share a similar experience you've had",
      "Try to cheer them up or distract them",
      "Ask what specific help they need"
    ],
    scoringWeights: {
      "A": { emotional_stability: 0.7, agreeableness: 0.5, extroversion: 0.3 },
      "B": { conscientiousness: 0.8, emotional_stability: 0.6, agreeableness: 0.5 },
      "C": { agreeableness: 0.9, emotional_stability: 0.7, extroversion: 0.5 },
      "D": { extroversion: 0.6, agreeableness: 0.7, collectivism: 0.6 },
      "E": { extroversion: 0.8, agreeableness: 0.7, emotional_stability: 0.5 },
      "F": { agreeableness: 0.8, conscientiousness: 0.7, collectivism: 0.6 }
    }
  },
  {
    questionNumber: 9,
    category: "Personality & Communication Style",
    questionText: "Your ideal way to spend free time is:",
    options: [
      "Trying new experiences and adventures",
      "Relaxing at home with close friends or family",
      "Pursuing hobbies and personal interests",
      "Learning something new or reading",
      "Being active and exercising",
      "Creating or building something"
    ],
    scoringWeights: {
      "A": { openness: 0.9, extroversion: 0.7, growth_mindset: 0.6 },
      "B": { extroversion: 0.3, agreeableness: 0.7, collectivism: 0.6 },
      "C": { extroversion: 0.4, openness: 0.6, conscientiousness: 0.6 },
      "D": { openness: 0.8, growth_mindset: 0.8, conscientiousness: 0.6 },
      "E": { health_focus: 0.8, extroversion: 0.6, emotional_stability: 0.7 },
      "F": { openness: 0.7, conscientiousness: 0.7, growth_mindset: 0.6 }
    }
  },
  {
    questionNumber: 10,
    category: "Work & Life Balance Philosophy",
    questionText: "You believe work should be:",
    options: [
      "A passion that doesn't feel like work",
      "A way to provide security for yourself and loved ones",
      "Balanced with plenty of time for personal life",
      "Meaningful and contribute to something larger",
      "Challenging and help you grow professionally",
      "Flexible and allow for life's unexpected moments"
    ],
    scoringWeights: {
      "A": { openness: 0.8, growth_mindset: 0.7, spiritual_inclination: 0.6 },
      "B": { conscientiousness: 0.8, emotional_stability: 0.7, collectivism: 0.6 },
      "C": { emotional_stability: 0.7, health_focus: 0.6, agreeableness: 0.6 },
      "D": { spiritual_inclination: 0.8, social_justice: 0.7, collectivism: 0.7 },
      "E": { growth_mindset: 0.8, conscientiousness: 0.7, openness: 0.6 },
      "F": { openness: 0.7, emotional_stability: 0.6, conscientiousness: 0.3 }
    }
  },
  {
    questionNumber: 11,
    category: "Work & Life Balance Philosophy",
    questionText: "Your approach to planning and spontaneity:",
    options: [
      "I love having everything planned and organized",
      "I prefer to go with the flow and be spontaneous",
      "I like a basic plan but enjoy unexpected opportunities",
      "I plan the important stuff but stay flexible on details",
      "I make loose plans but change them frequently",
      "I plan just enough to feel secure but not restricted"
    ],
    scoringWeights: {
      "A": { conscientiousness: 0.9, emotional_stability: 0.6, openness: 0.2 },
      "B": { openness: 0.8, extroversion: 0.6, conscientiousness: 0.2 },
      "C": { conscientiousness: 0.6, openness: 0.7, growth_mindset: 0.6 },
      "D": { conscientiousness: 0.7, emotional_stability: 0.6, openness: 0.5 },
      "E": { openness: 0.7, extroversion: 0.6, conscientiousness: 0.3 },
      "F": { conscientiousness: 0.6, emotional_stability: 0.7, openness: 0.4 }
    }
  },
  {
    questionNumber: 12,
    category: "Values & Lifestyle",
    questionText: "When it comes to money and possessions:",
    options: [
      "They're tools to create experiences and memories",
      "Security and saving for the future matter most",
      "They should be shared generously with others",
      "Simple living with fewer possessions is ideal",
      "They represent freedom and independence",
      "They're less important than relationships and time"
    ],
    scoringWeights: {
      "A": { openness: 0.8, extroversion: 0.6, environmental_consciousness: 0.4 },
      "B": { conscientiousness: 0.8, emotional_stability: 0.7, collectivism: 0.6 },
      "C": { agreeableness: 0.9, collectivism: 0.8, social_justice: 0.7 },
      "D": { environmental_consciousness: 0.8, spiritual_inclination: 0.7, veganism_support: 0.6 },
      "E": { openness: 0.6, extroversion: 0.5, collectivism: 0.3 },
      "F": { agreeableness: 0.8, collectivism: 0.7, spiritual_inclination: 0.6 }
    }
  },
  {
    questionNumber: 13,
    category: "Values & Lifestyle",
    questionText: "Your view on personal boundaries:",
    options: [
      "Strong boundaries are essential for healthy relationships",
      "Boundaries should be flexible based on the situation",
      "Being open and vulnerable builds deeper connections",
      "Some things should always remain private",
      "Boundaries can limit intimacy and closeness",
      "They should be communicated clearly and respected"
    ],
    scoringWeights: {
      "A": { emotional_stability: 0.8, conscientiousness: 0.7, agreeableness: 0.4 },
      "B": { openness: 0.7, agreeableness: 0.6, emotional_stability: 0.5 },
      "C": { agreeableness: 0.8, extroversion: 0.6, emotional_stability: 0.4 },
      "D": { emotional_stability: 0.7, conscientiousness: 0.6, extroversion: 0.3 },
      "E": { agreeableness: 0.6, extroversion: 0.7, emotional_stability: 0.3 },
      "F": { conscientiousness: 0.8, agreeableness: 0.7, emotional_stability: 0.6 }
    }
  },
  {
    questionNumber: 14,
    category: "Values & Lifestyle",
    questionText: "How do you typically deal with stress?",
    options: [
      "Exercise or physical activity",
      "Talk it through with friends or family",
      "Take time alone to think and process",
      "Focus on solving the underlying problem",
      "Use humor and try to keep perspective",
      "Accept it as temporary and practice patience"
    ],
    scoringWeights: {
      "A": { health_focus: 0.9, emotional_stability: 0.7, extroversion: 0.5 },
      "B": { extroversion: 0.7, agreeableness: 0.7, collectivism: 0.6 },
      "C": { extroversion: 0.2, emotional_stability: 0.6, spiritual_inclination: 0.5 },
      "D": { conscientiousness: 0.8, emotional_stability: 0.7, growth_mindset: 0.6 },
      "E": { emotional_stability: 0.8, extroversion: 0.6, agreeableness: 0.6 },
      "F": { emotional_stability: 0.9, spiritual_inclination: 0.7, agreeableness: 0.6 }
    }
  },
  {
    questionNumber: 15,
    category: "Communication & Expression",
    questionText: "In conversations, you tend to:",
    options: [
      "Share your thoughts and feelings openly",
      "Ask lots of questions about the other person",
      "Use humor to connect and lighten the mood",
      "Focus on facts and information",
      "Express empathy and emotional support",
      "Tell stories and share experiences"
    ],
    scoringWeights: {
      "A": { extroversion: 0.8, agreeableness: 0.6, openness: 0.6 },
      "B": { agreeableness: 0.9, extroversion: 0.6, collectivism: 0.7 },
      "C": { extroversion: 0.7, agreeableness: 0.7, emotional_stability: 0.6 },
      "D": { conscientiousness: 0.7, emotional_stability: 0.6, openness: 0.4 },
      "E": { agreeableness: 0.9, emotional_stability: 0.6, collectivism: 0.7 },
      "F": { extroversion: 0.7, openness: 0.6, agreeableness: 0.6 }
    }
  },
  {
    questionNumber: 16,
    category: "Communication & Expression",
    questionText: "When making plans with others:",
    options: [
      "I prefer to take the lead and organize",
      "I like when others plan but I give input",
      "I'm happy to go along with whatever others want",
      "I suggest ideas but let the group decide",
      "I need to know all the details in advance",
      "I prefer loose plans that can evolve naturally"
    ],
    scoringWeights: {
      "A": { extroversion: 0.8, conscientiousness: 0.7, agreeableness: 0.4 },
      "B": { agreeableness: 0.7, conscientiousness: 0.6, collectivism: 0.6 },
      "C": { agreeableness: 0.9, extroversion: 0.4, conscientiousness: 0.3 },
      "D": { agreeableness: 0.8, extroversion: 0.6, collectivism: 0.7 },
      "E": { conscientiousness: 0.9, emotional_stability: 0.6, openness: 0.2 },
      "F": { openness: 0.8, agreeableness: 0.6, conscientiousness: 0.3 }
    }
  },
  {
    questionNumber: 17,
    category: "Personal Growth & Learning",
    questionText: "You learn best through:",
    options: [
      "Reading and researching on your own",
      "Hands-on experience and trial-and-error",
      "Discussing ideas with others",
      "Taking classes or structured learning",
      "Observing and modeling others",
      "Reflecting on your experiences"
    ],
    scoringWeights: {
      "A": { openness: 0.8, conscientiousness: 0.7, extroversion: 0.3 },
      "B": { openness: 0.7, extroversion: 0.6, growth_mindset: 0.7 },
      "C": { extroversion: 0.8, agreeableness: 0.7, collectivism: 0.6 },
      "D": { conscientiousness: 0.8, growth_mindset: 0.6, openness: 0.5 },
      "E": { extroversion: 0.4, emotional_stability: 0.6, growth_mindset: 0.5 },
      "F": { spiritual_inclination: 0.7, growth_mindset: 0.7, extroversion: 0.3 }
    }
  },
  {
    questionNumber: 18,
    category: "Personal Growth & Learning",
    questionText: "Your attitude toward change is:",
    options: [
      "I embrace change as exciting and necessary",
      "I accept change but prefer stability when possible",
      "I resist change unless absolutely necessary",
      "I like gradual change but not sudden shifts",
      "I create change when things get too routine",
      "I adapt to change but don't seek it out"
    ],
    scoringWeights: {
      "A": { openness: 0.9, growth_mindset: 0.8, extroversion: 0.6 },
      "B": { emotional_stability: 0.6, conscientiousness: 0.6, openness: 0.4 },
      "C": { conscientiousness: 0.7, emotional_stability: 0.4, openness: 0.2 },
      "D": { conscientiousness: 0.6, emotional_stability: 0.7, growth_mindset: 0.5 },
      "E": { openness: 0.8, extroversion: 0.6, growth_mindset: 0.7 },
      "F": { emotional_stability: 0.7, agreeableness: 0.6, openness: 0.5 }
    }
  },
  {
    questionNumber: 19,
    category: "Lifestyle & Ethics",
    questionText: "What best describes your relationship with food choices?",
    options: [
      "I'm vegan for ethical/environmental reasons",
      "I'm vegetarian or mostly plant-based",
      "I eat everything but respect others' choices",
      "I prioritize local/organic regardless of type",
      "Food choices are personal, not political",
      "I eat what I enjoy without much thought"
    ],
    scoringWeights: {
      "A": { veganism_support: 1.0, environmental_consciousness: 0.9, social_justice: 0.8 },
      "B": { veganism_support: 0.7, environmental_consciousness: 0.7, health_focus: 0.6 },
      "C": { veganism_support: 0.5, agreeableness: 0.7, openness: 0.6 },
      "D": { environmental_consciousness: 0.8, health_focus: 0.7, conscientiousness: 0.6 },
      "E": { veganism_support: 0.3, collectivism: 0.3, social_justice: 0.2 },
      "F": { veganism_support: 0.1, environmental_consciousness: 0.2, health_focus: 0.3 }
    }
  },
  {
    questionNumber: 20,
    category: "Lifestyle & Ethics",
    questionText: "How important is environmental impact in your daily decisions?",
    options: [
      "It's my top priority in most choices",
      "Very important, I make significant efforts",
      "Important, I do what's convenient",
      "Somewhat important, small changes",
      "Not a major factor in my decisions",
      "I prioritize other concerns first"
    ],
    scoringWeights: {
      "A": { environmental_consciousness: 1.0, social_justice: 0.8, conscientiousness: 0.7 },
      "B": { environmental_consciousness: 0.8, conscientiousness: 0.7, growth_mindset: 0.6 },
      "C": { environmental_consciousness: 0.6, agreeableness: 0.6, conscientiousness: 0.5 },
      "D": { environmental_consciousness: 0.4, agreeableness: 0.5, conscientiousness: 0.4 },
      "E": { environmental_consciousness: 0.2, collectivism: 0.3 },
      "F": { environmental_consciousness: 0.1, conscientiousness: 0.4 }
    }
  },
  {
    questionNumber: 21,
    category: "Lifestyle & Ethics",
    questionText: "What's your stance on animal rights and welfare?",
    options: [
      "Animals have equal rights to humans",
      "Animals deserve strong protection from suffering",
      "Animal welfare is important but humans come first",
      "Animals should be treated humanely",
      "It's natural to use animals for human needs",
      "I don't think much about animal issues"
    ],
    scoringWeights: {
      "A": { social_justice: 0.9, veganism_support: 0.9, agreeableness: 0.8 },
      "B": { social_justice: 0.7, veganism_support: 0.7, agreeableness: 0.8 },
      "C": { agreeableness: 0.6, social_justice: 0.5, veganism_support: 0.4 },
      "D": { agreeableness: 0.7, veganism_support: 0.5, conscientiousness: 0.5 },
      "E": { veganism_support: 0.2, social_justice: 0.3, collectivism: 0.4 },
      "F": { veganism_support: 0.1, social_justice: 0.2, agreeableness: 0.3 }
    }
  },
  {
    questionNumber: 22,
    category: "Lifestyle & Ethics",
    questionText: "How do you prioritize health and wellness?",
    options: [
      "It's central to everything I do",
      "Very important, I'm quite disciplined",
      "Important, I try to maintain good habits",
      "Somewhat important, could do better",
      "Not a major focus right now",
      "I live life without much health consideration"
    ],
    scoringWeights: {
      "A": { health_focus: 1.0, conscientiousness: 0.8, emotional_stability: 0.7 },
      "B": { health_focus: 0.8, conscientiousness: 0.8, growth_mindset: 0.6 },
      "C": { health_focus: 0.6, conscientiousness: 0.6, emotional_stability: 0.6 },
      "D": { health_focus: 0.4, growth_mindset: 0.5, conscientiousness: 0.4 },
      "E": { health_focus: 0.2, conscientiousness: 0.3 },
      "F": { health_focus: 0.1, openness: 0.3 }
    }
  }
];

async function seedPersonalityQuestions() {
  console.log('Starting to seed personality questions...');

  try {
    // Delete existing questions
    await prisma.personalityAnswer.deleteMany();
    await prisma.personalityQuestion.deleteMany();

    // Insert new questions
    for (const question of personalityQuestions) {
      await prisma.personalityQuestion.create({
        data: question
      });
    }

    console.log(`✅ Successfully seeded ${personalityQuestions.length} personality questions`);
  } catch (error) {
    console.error('❌ Error seeding personality questions:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  seedPersonalityQuestions()
    .then(() => {
      console.log('✅ Personality questions seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Personality questions seeding failed:', error);
      process.exit(1);
    });
}

export { seedPersonalityQuestions };