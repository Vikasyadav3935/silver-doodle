import { PrismaClient, Gender, GenderPreference, QuestionType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create interests
  console.log('Creating interests...');
  const interestData = [
    { name: 'Photography', category: 'Creative' },
    { name: 'Travel', category: 'Adventure' },
    { name: 'Yoga', category: 'Fitness' },
    { name: 'Music', category: 'Creative' },
    { name: 'Cooking', category: 'Lifestyle' },
    { name: 'Hiking', category: 'Adventure' },
    { name: 'Gaming', category: 'Entertainment' },
    { name: 'Books', category: 'Intellectual' },
    { name: 'Art', category: 'Creative' },
    { name: 'Dancing', category: 'Creative' },
    { name: 'Movies', category: 'Entertainment' },
    { name: 'Sports', category: 'Fitness' },
    { name: 'Wine Tasting', category: 'Lifestyle' },
    { name: 'Meditation', category: 'Wellness' },
    { name: 'Running', category: 'Fitness' },
    { name: 'Coffee', category: 'Lifestyle' },
    { name: 'Beach', category: 'Adventure' },
    { name: 'Technology', category: 'Intellectual' },
    { name: 'Fashion', category: 'Lifestyle' },
    { name: 'Pets', category: 'Lifestyle' }
  ];

  for (const interest of interestData) {
    await prisma.interest.upsert({
      where: { name: interest.name },
      update: {},
      create: interest
    });
  }

  // Create sample questions
  console.log('Creating questions...');
  const questionData = [
    {
      text: 'What are you looking for?',
      category: 'Dating Goals',
      type: QuestionType.SINGLE_CHOICE,
      options: JSON.stringify(['Long-term relationship', 'Short-term dating', 'Friendship', 'Not sure yet']),
      isRequired: true,
      order: 1
    },
    {
      text: 'Do you have children?',
      category: 'Family',
      type: QuestionType.SINGLE_CHOICE,
      options: JSON.stringify(['Yes, and they live with me', 'Yes, but they don\'t live with me', 'No', 'Prefer not to say']),
      isRequired: false,
      order: 2
    },
    {
      text: 'Do you want children?',
      category: 'Family',
      type: QuestionType.SINGLE_CHOICE,
      options: JSON.stringify(['Want children', 'Don\'t want children', 'Open to children', 'Not sure']),
      isRequired: false,
      order: 3
    },
    {
      text: 'How often do you exercise?',
      category: 'Lifestyle',
      type: QuestionType.SINGLE_CHOICE,
      options: JSON.stringify(['Every day', 'A few times a week', 'Once a week', 'Rarely', 'Never']),
      isRequired: false,
      order: 4
    },
    {
      text: 'Do you smoke?',
      category: 'Lifestyle',
      type: QuestionType.SINGLE_CHOICE,
      options: JSON.stringify(['No', 'Socially', 'Regularly', 'Trying to quit']),
      isRequired: false,
      order: 5
    },
    {
      text: 'How often do you drink?',
      category: 'Lifestyle',
      type: QuestionType.SINGLE_CHOICE,
      options: JSON.stringify(['Never', 'Rarely', 'Socially', 'Regularly']),
      isRequired: false,
      order: 6
    },
    {
      text: 'What\'s your education level?',
      category: 'Background',
      type: QuestionType.SINGLE_CHOICE,
      options: JSON.stringify(['High school', 'Some college', 'Bachelor\'s degree', 'Master\'s degree', 'PhD', 'Trade school']),
      isRequired: false,
      order: 7
    },
    {
      text: 'What\'s your political affiliation?',
      category: 'Values',
      type: QuestionType.SINGLE_CHOICE,
      options: JSON.stringify(['Liberal', 'Moderate', 'Conservative', 'Other', 'Prefer not to say']),
      isRequired: false,
      order: 8
    },
    {
      text: 'What\'s your religion?',
      category: 'Values',
      type: QuestionType.SINGLE_CHOICE,
      options: JSON.stringify(['Christian', 'Jewish', 'Muslim', 'Hindu', 'Buddhist', 'Other', 'Not religious', 'Spiritual']),
      isRequired: false,
      order: 9
    },
    {
      text: 'What\'s your ideal first date?',
      category: 'Dating',
      type: QuestionType.TEXT,
      isRequired: false,
      order: 10
    }
  ];

  for (const question of questionData) {
    const existingQuestion = await prisma.question.findFirst({
      where: { text: question.text }
    });
    
    if (!existingQuestion) {
      await prisma.question.create({
        data: question
      });
    }
  }

  // Create a demo user (for development/testing only)
  if (process.env.NODE_ENV === 'development') {
    console.log('Creating demo user...');
    
    const demoUser = await prisma.user.upsert({
      where: { phoneNumber: '+1234567890' },
      update: {},
      create: {
        phoneNumber: '+1234567890',
        email: 'demo@connect.app',
        isVerified: true
      }
    });

    // Create demo profile
    await prisma.profile.upsert({
      where: { userId: demoUser.id },
      update: {},
      create: {
        userId: demoUser.id,
        firstName: 'Demo',
        lastName: 'User',
        dateOfBirth: new Date('1995-01-01'),
        gender: Gender.MALE,
        bio: 'This is a demo user for testing purposes.',
        occupation: 'Software Developer',
        education: 'Bachelor\'s Degree',
        height: 180,
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        latitude: 37.7749,
        longitude: -122.4194,
        profileCompleteness: 80
      }
    });

    // Create demo user settings
    await prisma.userSettings.upsert({
      where: { userId: demoUser.id },
      update: {},
      create: {
        userId: demoUser.id
      }
    });

    console.log('Demo user created with phone: +1234567890');
  }

  console.log('✅ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });