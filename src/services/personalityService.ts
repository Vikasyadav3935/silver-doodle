import { prisma } from '@/server';
import { AppError } from '@/utils/AppError';
import { logger } from '@/utils/logger';
import { Decimal } from '@prisma/client/runtime/library';

interface PersonalityAnswer {
  questionId: string;
  selectedOption: string;
  optionIndex: number;
}

interface PersonalityScores {
  extroversion: number;
  openness: number;
  conscientiousness: number;
  agreeableness: number;
  emotional_stability: number;
  growth_mindset: number;
  collectivism: number;
  spiritual_inclination: number;
  veganism_support: number;
  environmental_consciousness: number;
  health_focus: number;
  social_justice: number;
}

interface TraitScores {
  [key: string]: number;
}

export class PersonalityService {
  async getPersonalityQuestions() {
    try {
      const questions = await prisma.personalityQuestion.findMany({
        orderBy: { questionNumber: 'asc' },
        select: {
          id: true,
          questionNumber: true,
          category: true,
          questionText: true,
          options: true
        }
      });

      return {
        success: true,
        questions: questions.map(q => ({
          id: q.id,
          questionNumber: q.questionNumber,
          category: q.category,
          question: q.questionText,
          options: q.options as string[]
        }))
      };
    } catch (error) {
      logger.error('Error fetching personality questions:', error);
      throw new AppError('Failed to fetch personality questions', 500);
    }
  }

  async submitPersonalityAnswers(userId: string, answers: PersonalityAnswer[]) {
    try {
      // Get user's profile
      const profile = await prisma.profile.findUnique({
        where: { userId }
      });

      if (!profile) {
        throw new AppError('User profile not found', 404);
      }

      // Get all questions with their scoring weights
      const questions = await prisma.personalityQuestion.findMany({
        select: {
          id: true,
          questionNumber: true,
          scoringWeights: true
        }
      });

      const questionMap = new Map(questions.map(q => [q.id, q]));

      // Start transaction
      const result = await prisma.$transaction(async (tx) => {
        // Delete existing answers for this profile
        await tx.personalityAnswer.deleteMany({
          where: { profileId: profile.id }
        });

        // Insert new answers
        const answerPromises = answers.map(answer => {
          const question = questionMap.get(answer.questionId);
          if (!question) {
            throw new AppError(`Question not found: ${answer.questionId}`, 400);
          }

          return tx.personalityAnswer.create({
            data: {
              profileId: profile.id,
              questionId: answer.questionId,
              selectedOption: answer.selectedOption,
              optionIndex: answer.optionIndex
            }
          });
        });

        await Promise.all(answerPromises);

        // Calculate personality scores
        const personalityScores = this.calculatePersonalityScores(answers, questionMap);

        // Update profile with calculated scores
        const updatedProfile = await tx.profile.update({
          where: { id: profile.id },
          data: {
            extroversion: new Decimal(personalityScores.extroversion),
            openness: new Decimal(personalityScores.openness),
            conscientiousness: new Decimal(personalityScores.conscientiousness),
            agreeableness: new Decimal(personalityScores.agreeableness),
            emotional_stability: new Decimal(personalityScores.emotional_stability),
            growth_mindset: new Decimal(personalityScores.growth_mindset),
            collectivism: new Decimal(personalityScores.collectivism),
            spiritual_inclination: new Decimal(personalityScores.spiritual_inclination),
            veganism_support: new Decimal(personalityScores.veganism_support),
            environmental_consciousness: new Decimal(personalityScores.environmental_consciousness),
            health_focus: new Decimal(personalityScores.health_focus),
            social_justice: new Decimal(personalityScores.social_justice),
            personality_quiz_completed: true,
            personality_quiz_completed_at: new Date()
          }
        });

        return { updatedProfile, personalityScores };
      });

      // Clear any cached compatibility scores for this user
      await this.clearCompatibilityCache(userId);

      return {
        success: true,
        message: 'Personality questionnaire completed successfully',
        personalityScores: result.personalityScores
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error submitting personality answers:', error);
      throw new AppError('Failed to submit personality answers', 500);
    }
  }

  async getUserPersonalityScores(userId: string) {
    try {
      const profile = await prisma.profile.findUnique({
        where: { userId },
        select: {
          extroversion: true,
          openness: true,
          conscientiousness: true,
          agreeableness: true,
          emotional_stability: true,
          growth_mindset: true,
          collectivism: true,
          spiritual_inclination: true,
          veganism_support: true,
          environmental_consciousness: true,
          health_focus: true,
          social_justice: true,
          personality_quiz_completed: true,
          personality_quiz_completed_at: true
        }
      });

      if (!profile) {
        throw new AppError('User profile not found', 404);
      }

      if (!profile.personality_quiz_completed) {
        return {
          success: true,
          isCompleted: false,
          personalityScores: null
        };
      }

      const personalityScores = {
        extroversion: Number(profile.extroversion),
        openness: Number(profile.openness),
        conscientiousness: Number(profile.conscientiousness),
        agreeableness: Number(profile.agreeableness),
        emotional_stability: Number(profile.emotional_stability),
        growth_mindset: Number(profile.growth_mindset),
        collectivism: Number(profile.collectivism),
        spiritual_inclination: Number(profile.spiritual_inclination),
        veganism_support: Number(profile.veganism_support),
        environmental_consciousness: Number(profile.environmental_consciousness),
        health_focus: Number(profile.health_focus),
        social_justice: Number(profile.social_justice)
      };

      return {
        success: true,
        isCompleted: true,
        personalityScores,
        completedAt: profile.personality_quiz_completed_at
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error fetching personality scores:', error);
      throw new AppError('Failed to fetch personality scores', 500);
    }
  }

  async calculateCompatibility(user1Id: string, user2Id: string) {
    try {
      // Check cache first
      const cachedScore = await this.getCachedCompatibilityScore(user1Id, user2Id);
      if (cachedScore) {
        return {
          success: true,
          compatibilityScore: cachedScore
        };
      }

      // Get both users' personality scores
      const [user1Profile, user2Profile] = await Promise.all([
        prisma.profile.findUnique({
          where: { userId: user1Id },
          select: {
            extroversion: true,
            openness: true,
            conscientiousness: true,
            agreeableness: true,
            emotional_stability: true,
            growth_mindset: true,
            collectivism: true,
            spiritual_inclination: true,
            veganism_support: true,
            environmental_consciousness: true,
            health_focus: true,
            social_justice: true,
            personality_quiz_completed: true
          }
        }),
        prisma.profile.findUnique({
          where: { userId: user2Id },
          select: {
            extroversion: true,
            openness: true,
            conscientiousness: true,
            agreeableness: true,
            emotional_stability: true,
            growth_mindset: true,
            collectivism: true,
            spiritual_inclination: true,
            veganism_support: true,
            environmental_consciousness: true,
            health_focus: true,
            social_justice: true,
            personality_quiz_completed: true
          }
        })
      ]);

      if (!user1Profile || !user2Profile) {
        throw new AppError('One or both user profiles not found', 404);
      }

      if (!user1Profile.personality_quiz_completed || !user2Profile.personality_quiz_completed) {
        throw new AppError('Both users must complete personality questionnaire for compatibility calculation', 400);
      }

      // Calculate compatibility
      const compatibility = this.calculateCompatibilityScores(user1Profile, user2Profile);

      // Cache the result
      await this.cacheCompatibilityScore(user1Id, user2Id, compatibility);

      return {
        success: true,
        compatibilityScore: compatibility
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error calculating compatibility:', error);
      throw new AppError('Failed to calculate compatibility', 500);
    }
  }

  async calculateBulkCompatibility(userId: string, targetUserIds: string[]) {
    try {
      const results = await Promise.allSettled(
        targetUserIds.map(targetId => this.calculateCompatibility(userId, targetId))
      );

      const compatibilityScores = results
        .map((result, index) => ({
          userId: targetUserIds[index],
          ...(result.status === 'fulfilled' ? result.value : { error: 'Calculation failed' })
        }))
        .filter(result => result.success);

      return {
        success: true,
        compatibilityScores
      };
    } catch (error) {
      logger.error('Error calculating bulk compatibility:', error);
      throw new AppError('Failed to calculate bulk compatibility', 500);
    }
  }

  async resetPersonalityData(userId: string) {
    try {
      const profile = await prisma.profile.findUnique({
        where: { userId }
      });

      if (!profile) {
        throw new AppError('User profile not found', 404);
      }

      await prisma.$transaction(async (tx) => {
        // Delete personality answers
        await tx.personalityAnswer.deleteMany({
          where: { profileId: profile.id }
        });

        // Reset personality scores in profile
        await tx.profile.update({
          where: { id: profile.id },
          data: {
            extroversion: null,
            openness: null,
            conscientiousness: null,
            agreeableness: null,
            emotional_stability: null,
            growth_mindset: null,
            collectivism: null,
            spiritual_inclination: null,
            veganism_support: null,
            environmental_consciousness: null,
            health_focus: null,
            social_justice: null,
            personality_quiz_completed: false,
            personality_quiz_completed_at: null
          }
        });
      });

      // Clear compatibility cache
      await this.clearCompatibilityCache(userId);

      return {
        success: true,
        message: 'Personality data has been reset. You can now retake the questionnaire.'
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error resetting personality data:', error);
      throw new AppError('Failed to reset personality data', 500);
    }
  }

  async getPersonalityInsights(userId: string) {
    try {
      const personalityResult = await this.getUserPersonalityScores(userId);
      
      if (!personalityResult.isCompleted || !personalityResult.personalityScores) {
        throw new AppError('Personality questionnaire not completed', 400);
      }

      const scores = personalityResult.personalityScores;
      const insights = this.generatePersonalityInsights(scores);

      return {
        success: true,
        insights,
        personalityScores: scores
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error generating personality insights:', error);
      throw new AppError('Failed to generate personality insights', 500);
    }
  }

  private calculatePersonalityScores(answers: PersonalityAnswer[], questionMap: Map<string, any>): PersonalityScores {
    const traitSums: { [key: string]: number } = {};
    const traitCounts: { [key: string]: number } = {};

    answers.forEach(answer => {
      const question = questionMap.get(answer.questionId);
      if (!question || !question.scoringWeights) return;

      const weights = question.scoringWeights as any;
      const optionKey = String.fromCharCode(65 + answer.optionIndex); // A, B, C, etc.
      const optionWeights = weights[optionKey];

      if (optionWeights) {
        Object.entries(optionWeights).forEach(([trait, weight]) => {
          if (typeof weight === 'number') {
            traitSums[trait] = (traitSums[trait] || 0) + weight;
            traitCounts[trait] = (traitCounts[trait] || 0) + 1;
          }
        });
      }
    });

    // Calculate averages and ensure all traits have values
    const traits = [
      'extroversion', 'openness', 'conscientiousness', 'agreeableness',
      'emotional_stability', 'growth_mindset', 'collectivism', 'spiritual_inclination',
      'veganism_support', 'environmental_consciousness', 'health_focus', 'social_justice'
    ];

    const scores: PersonalityScores = {} as PersonalityScores;
    
    traits.forEach(trait => {
      if (traitCounts[trait] > 0) {
        scores[trait as keyof PersonalityScores] = Math.round((traitSums[trait] / traitCounts[trait]) * 100) / 100;
      } else {
        scores[trait as keyof PersonalityScores] = 0.5; // Default neutral score
      }
    });

    return scores;
  }

  private calculateCompatibilityScores(user1: any, user2: any) {
    const coreTraits = ['extroversion', 'openness', 'conscientiousness', 'agreeableness', 'emotional_stability', 'growth_mindset', 'collectivism', 'spiritual_inclination'];
    const lifestyleTraits = ['veganism_support', 'environmental_consciousness', 'health_focus', 'social_justice'];

    // Calculate core personality compatibility (60% weight)
    let coreScore = 0;
    const traitScores: TraitScores = {};

    coreTraits.forEach(trait => {
      const val1 = Number(user1[trait]) || 0.5;
      const val2 = Number(user2[trait]) || 0.5;
      let difference = Math.abs(val1 - val2);
      
      // Special handling for extroversion (some opposites attract)
      if (trait === 'extroversion') {
        const optimalDiff = 0.3;
        if (Math.abs(difference - optimalDiff) < 0.1) {
          difference = Math.max(0, difference - 0.1);
        }
      }
      
      const traitCompatibility = Math.max(0, 1 - difference);
      traitScores[trait] = Math.round(traitCompatibility * 100);
      coreScore += traitCompatibility;
    });
    
    const corePersonalityScore = (coreScore / coreTraits.length) * 60;

    // Calculate lifestyle compatibility (40% weight)
    let lifestyleScore = 0;
    let criticalMismatch = false;

    lifestyleTraits.forEach(trait => {
      const val1 = Number(user1[trait]) || 0.5;
      const val2 = Number(user2[trait]) || 0.5;
      const difference = Math.abs(val1 - val2);
      
      // Check for deal breakers
      if ((trait === 'veganism_support' || trait === 'environmental_consciousness' || trait === 'social_justice') &&
          difference > 0.6 && (val1 > 0.8 || val2 > 0.8)) {
        criticalMismatch = true;
      }
      
      const traitCompatibility = Math.max(0, 1 - difference);
      traitScores[trait] = Math.round(traitCompatibility * 100);
      lifestyleScore += traitCompatibility;
    });

    const lifestyleCompatibilityScore = (lifestyleScore / lifestyleTraits.length) * 40;

    // Apply penalty for critical mismatches
    let finalScore = corePersonalityScore + lifestyleCompatibilityScore;
    if (criticalMismatch) {
      finalScore *= 0.5;
    }

    // Bonuses for complementary traits
    const extroversionDiff = Math.abs(Number(user1.extroversion) - Number(user2.extroversion));
    if (Math.abs(extroversionDiff - 0.3) < 0.1) {
      finalScore += 10;
    }

    const bothHighGrowth = Number(user1.growth_mindset) > 0.7 && Number(user2.growth_mindset) > 0.7;
    if (bothHighGrowth) {
      finalScore += 10;
    }

    return {
      userId: '', // Will be set by caller
      overallScore: Math.round(Math.min(100, Math.max(0, finalScore))),
      personalityScore: Math.round(corePersonalityScore),
      lifestyleScore: Math.round(lifestyleCompatibilityScore),
      traitScores
    };
  }

  private async getCachedCompatibilityScore(user1Id: string, user2Id: string) {
    try {
      // Order user IDs consistently for cache lookup
      const [orderedUser1, orderedUser2] = [user1Id, user2Id].sort();
      
      const cached = await prisma.compatibilityScore.findUnique({
        where: {
          user1Id_user2Id: {
            user1Id: orderedUser1,
            user2Id: orderedUser2
          }
        }
      });

      if (cached && cached.expiresAt > new Date()) {
        return {
          userId: user1Id === orderedUser1 ? user2Id : user1Id,
          overallScore: Number(cached.overallScore),
          personalityScore: Number(cached.personalityScore),
          lifestyleScore: Number(cached.lifestyleScore),
          traitScores: cached.traitScores as TraitScores
        };
      }

      return null;
    } catch (error) {
      logger.error('Error getting cached compatibility score:', error);
      return null;
    }
  }

  private async cacheCompatibilityScore(user1Id: string, user2Id: string, compatibility: any) {
    try {
      // Order user IDs consistently for cache storage
      const [orderedUser1, orderedUser2] = [user1Id, user2Id].sort();
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Cache for 7 days

      await prisma.compatibilityScore.upsert({
        where: {
          user1Id_user2Id: {
            user1Id: orderedUser1,
            user2Id: orderedUser2
          }
        },
        update: {
          overallScore: new Decimal(compatibility.overallScore),
          personalityScore: new Decimal(compatibility.personalityScore),
          lifestyleScore: new Decimal(compatibility.lifestyleScore),
          traitScores: compatibility.traitScores,
          expiresAt,
          calculatedAt: new Date()
        },
        create: {
          user1Id: orderedUser1,
          user2Id: orderedUser2,
          overallScore: new Decimal(compatibility.overallScore),
          personalityScore: new Decimal(compatibility.personalityScore),
          lifestyleScore: new Decimal(compatibility.lifestyleScore),
          traitScores: compatibility.traitScores,
          expiresAt,
          calculatedAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Error caching compatibility score:', error);
    }
  }

  private async clearCompatibilityCache(userId: string) {
    try {
      await prisma.compatibilityScore.deleteMany({
        where: {
          OR: [
            { user1Id: userId },
            { user2Id: userId }
          ]
        }
      });
    } catch (error) {
      logger.error('Error clearing compatibility cache:', error);
    }
  }

  private generatePersonalityInsights(scores: PersonalityScores) {
    const insights = {
      primaryTraits: [] as string[],
      strengths: [] as string[],
      challenges: [] as string[],
      relationshipStyle: '',
      compatibilityTips: [] as string[]
    };

    // Identify primary traits (scores > 0.7)
    Object.entries(scores).forEach(([trait, score]) => {
      if (score > 0.7) {
        insights.primaryTraits.push(trait.replace('_', ' '));
      }
    });

    // Generate insights based on trait combinations
    if (scores.extroversion > 0.7) {
      insights.strengths.push('You energize others and build connections easily');
      insights.relationshipStyle = 'You thrive in social relationships and enjoy shared activities';
    } else if (scores.extroversion < 0.3) {
      insights.strengths.push('You form deep, meaningful connections');
      insights.relationshipStyle = 'You prefer intimate relationships with quality time together';
    }

    if (scores.growth_mindset > 0.7) {
      insights.strengths.push('You embrace challenges and continuous improvement');
      insights.compatibilityTips.push('Look for partners who also value personal growth');
    }

    if (scores.agreeableness > 0.7) {
      insights.strengths.push('You create harmony and show empathy for others');
      insights.challenges.push('You might need to practice setting boundaries');
    }

    if (scores.environmental_consciousness > 0.7) {
      insights.compatibilityTips.push('Environmental values are important to you - find someone who shares them');
    }

    return insights;
  }
}