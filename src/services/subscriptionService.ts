import Stripe from 'stripe';
import { prisma } from '@/server';
import { AppError } from '@/utils/AppError';
import { logger } from '@/utils/logger';
import { SubscriptionPlan, SubscriptionStatus, PaymentPurpose, PaymentStatus, BoostType } from '@prisma/client';

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

export class SubscriptionService {
  async getSubscriptionPlans() {
    try {
      const plans = [
        {
          id: 'free',
          name: 'Free',
          plan: SubscriptionPlan.FREE,
          price: 0,
          duration: 'Forever',
          features: {
            likes: 10,
            superLikes: 1,
            rewinds: 0,
            boosts: 0,
            whoLikedYou: false,
            unlimitedLikes: false,
            premiumFilters: false,
            prioritySupport: false,
            profileBoost: false,
            readReceipts: false,
            onlineStatus: false,
            topPicks: false
          }
        },
        {
          id: 'premium',
          name: 'Premium',
          plan: SubscriptionPlan.PREMIUM,
          price: 9.99,
          duration: 'Monthly',
          stripeProductId: process.env.STRIPE_PREMIUM_PRODUCT_ID,
          stripePriceId: process.env.STRIPE_PREMIUM_PRICE_ID,
          features: {
            likes: 100,
            superLikes: 5,
            rewinds: 5,
            boosts: 1,
            whoLikedYou: true,
            unlimitedLikes: false,
            premiumFilters: true,
            prioritySupport: true,
            profileBoost: true,
            readReceipts: true,
            onlineStatus: true,
            topPicks: true
          }
        },
        {
          id: 'gold',
          name: 'Gold',
          plan: SubscriptionPlan.GOLD,
          price: 19.99,
          duration: 'Monthly',
          stripeProductId: process.env.STRIPE_GOLD_PRODUCT_ID,
          stripePriceId: process.env.STRIPE_GOLD_PRICE_ID,
          features: {
            likes: -1, // Unlimited
            superLikes: 10,
            rewinds: 10,
            boosts: 5,
            whoLikedYou: true,
            unlimitedLikes: true,
            premiumFilters: true,
            prioritySupport: true,
            profileBoost: true,
            readReceipts: true,
            onlineStatus: true,
            topPicks: true
          }
        }
      ];

      return {
        success: true,
        plans
      };
    } catch (error) {
      logger.error('Error getting subscription plans:', error);
      throw new AppError('Failed to get subscription plans', 500);
    }
  }

  async getUserSubscription(userId: string) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              profile: {
                select: { firstName: true }
              }
            }
          }
        }
      });

      if (!subscription) {
        return {
          success: true,
          subscription: {
            plan: SubscriptionPlan.FREE,
            status: SubscriptionStatus.ACTIVE,
            features: this.getFreeFeatures()
          }
        };
      }

      // Check if subscription is expired
      if (subscription.endDate < new Date()) {
        await this.expireSubscription(subscription.id);
        return {
          success: true,
          subscription: {
            plan: SubscriptionPlan.FREE,
            status: SubscriptionStatus.EXPIRED,
            features: this.getFreeFeatures()
          }
        };
      }

      return {
        success: true,
        subscription: {
          ...subscription,
          features: this.getFeaturesByPlan(subscription.plan)
        }
      };
    } catch (error) {
      logger.error('Error getting user subscription:', error);
      throw new AppError('Failed to get subscription', 500);
    }
  }

  async createSubscription(userId: string, planId: string) {
    try {
      if (!stripe) {
        throw new AppError('Payment processing is not configured', 500);
      }

      // Get plan details
      const plansResponse = await this.getSubscriptionPlans();
      const plan = plansResponse.plans.find(p => p.id === planId);
      
      if (!plan || plan.plan === SubscriptionPlan.FREE) {
        throw new AppError('Invalid subscription plan', 400);
      }

      // Get or create Stripe customer
      const customer = await this.getOrCreateStripeCustomer(userId);

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [
          {
            price: plan.stripePriceId,
            quantity: 1,
          },
        ],
        success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`,
        metadata: {
          userId,
          planId
        }
      });

      return {
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id
      };
    } catch (error) {
      logger.error('Error creating subscription:', error);
      throw new AppError('Failed to create subscription', 500);
    }
  }

  async cancelSubscription(userId: string) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { userId }
      });

      if (!subscription) {
        throw new AppError('No active subscription found', 404);
      }

      if (!stripe || !subscription.stripeSubscriptionId) {
        throw new AppError('Cannot cancel subscription', 400);
      }

      // Cancel at period end in Stripe
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true
      });

      // Update local subscription
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          canceledAt: new Date(),
          status: SubscriptionStatus.CANCELED
        }
      });

      return {
        success: true,
        message: 'Subscription will be canceled at the end of the billing period'
      };
    } catch (error) {
      logger.error('Error canceling subscription:', error);
      throw new AppError('Failed to cancel subscription', 500);
    }
  }

  async processWebhook(body: string, signature: string) {
    try {
      if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
        throw new AppError('Webhook processing not configured', 500);
      }

      // Verify webhook signature
      const event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as any);
          break;
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as any);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as any);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as any);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as any);
          break;
        default:
          logger.info(`Unhandled webhook event type: ${event.type}`);
      }

      return { success: true };
    } catch (error) {
      logger.error('Error processing webhook:', error);
      throw new AppError('Failed to process webhook', 500);
    }
  }

  async purchaseBoost(userId: string, boostType: BoostType, duration: number = 30) {
    try {
      const price = boostType === BoostType.PROFILE_BOOST ? 4.99 : 2.99;
      
      // Create payment record
      await prisma.payment.create({
        data: {
          userId,
          amount: price,
          currency: 'USD',
          purpose: PaymentPurpose.BOOST,
          status: PaymentStatus.COMPLETED // In real implementation, this would be PENDING until payment is processed
        }
      });

      // Create boost
      const boost = await prisma.boost.create({
        data: {
          userId,
          type: boostType,
          duration,
          startedAt: new Date(),
          endsAt: new Date(Date.now() + duration * 60 * 1000) // duration in minutes
        }
      });

      return {
        success: true,
        boost
      };
    } catch (error) {
      logger.error('Error purchasing boost:', error);
      throw new AppError('Failed to purchase boost', 500);
    }
  }

  async getActiveBoosts(userId: string) {
    try {
      const boosts = await prisma.boost.findMany({
        where: {
          userId,
          endsAt: {
            gte: new Date()
          }
        },
        orderBy: { endsAt: 'desc' }
      });

      return {
        success: true,
        boosts
      };
    } catch (error) {
      logger.error('Error getting active boosts:', error);
      throw new AppError('Failed to get boosts', 500);
    }
  }

  async checkFeatureAccess(userId: string, feature: string): Promise<boolean> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const features = subscription.subscription.features;

      switch (feature) {
        case 'unlimited_likes':
          return features.unlimitedLikes;
        case 'who_liked_you':
          return features.whoLikedYou;
        case 'super_likes':
          return features.superLikes > 0;
        case 'rewinds':
          return features.rewinds > 0;
        case 'boosts':
          return features.boosts > 0;
        case 'premium_filters':
          return features.premiumFilters;
        case 'read_receipts':
          return features.readReceipts;
        case 'online_status':
          return features.onlineStatus;
        case 'top_picks':
          return features.topPicks;
        default:
          return false;
      }
    } catch (error) {
      logger.error('Error checking feature access:', error);
      return false;
    }
  }

  private async handleCheckoutCompleted(session: Record<string, any>) {
    try {
      const userId = session.metadata.userId;
      const planId = session.metadata.planId;

      // Get subscription from Stripe
      const stripeSubscription = await stripe!.subscriptions.retrieve(session.subscription);
      
      const planEnum = planId === 'premium' ? SubscriptionPlan.PREMIUM : SubscriptionPlan.GOLD;
      const endDate = new Date(stripeSubscription.current_period_end * 1000);

      // Create or update subscription
      await prisma.subscription.upsert({
        where: { userId },
        update: {
          plan: planEnum,
          status: SubscriptionStatus.ACTIVE,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          startDate: new Date(stripeSubscription.current_period_start * 1000),
          endDate,
          features: this.getFeaturesByPlan(planEnum)
        },
        create: {
          userId,
          plan: planEnum,
          status: SubscriptionStatus.ACTIVE,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          startDate: new Date(stripeSubscription.current_period_start * 1000),
          endDate,
          features: this.getFeaturesByPlan(planEnum)
        }
      });

      logger.info(`Subscription created for user ${userId}: ${planId}`);
    } catch (error) {
      logger.error('Error handling checkout completed:', error);
    }
  }

  private async handlePaymentSucceeded(invoice: Record<string, any>) {
    // Handle successful payment
    logger.info(`Payment succeeded for subscription: ${invoice.subscription}`);
  }

  private async handlePaymentFailed(invoice: Record<string, any>) {
    // Handle failed payment
    logger.error(`Payment failed for subscription: ${invoice.subscription}`);
  }

  private async handleSubscriptionUpdated(subscription: Record<string, any>) {
    // Handle subscription updates
    logger.info(`Subscription updated: ${subscription.id}`);
  }

  private async handleSubscriptionDeleted(subscription: Record<string, any>) {
    try {
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: SubscriptionStatus.CANCELED }
      });
      
      logger.info(`Subscription deleted: ${subscription.id}`);
    } catch (error) {
      logger.error('Error handling subscription deletion:', error);
    }
  }

  private async getOrCreateStripeCustomer(userId: string) {
    if (!stripe) {
      throw new AppError('Stripe not configured', 500);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check if user already has a Stripe customer
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId },
      select: { stripeCustomerId: true }
    });

    if (existingSubscription?.stripeCustomerId) {
      return stripe.customers.retrieve(existingSubscription.stripeCustomerId) as Promise<Record<string, any>>;
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      name: user.profile?.firstName || undefined,
      phone: user.phoneNumber,
      metadata: { userId }
    });

    return customer;
  }

  private async expireSubscription(subscriptionId: string) {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubscriptionStatus.EXPIRED }
    });
  }

  private getFreeFeatures() {
    return {
      likes: 10,
      superLikes: 1,
      rewinds: 0,
      boosts: 0,
      whoLikedYou: false,
      unlimitedLikes: false,
      premiumFilters: false,
      prioritySupport: false,
      profileBoost: false,
      readReceipts: false,
      onlineStatus: false,
      topPicks: false
    };
  }

  private getFeaturesByPlan(plan: SubscriptionPlan) {
    switch (plan) {
      case SubscriptionPlan.PREMIUM:
        return {
          likes: 100,
          superLikes: 5,
          rewinds: 5,
          boosts: 1,
          whoLikedYou: true,
          unlimitedLikes: false,
          premiumFilters: true,
          prioritySupport: true,
          profileBoost: true,
          readReceipts: true,
          onlineStatus: true,
          topPicks: true
        };
      case SubscriptionPlan.GOLD:
        return {
          likes: -1,
          superLikes: 10,
          rewinds: 10,
          boosts: 5,
          whoLikedYou: true,
          unlimitedLikes: true,
          premiumFilters: true,
          prioritySupport: true,
          profileBoost: true,
          readReceipts: true,
          onlineStatus: true,
          topPicks: true
        };
      default:
        return this.getFreeFeatures();
    }
  }
}