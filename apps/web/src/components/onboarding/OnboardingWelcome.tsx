import { Modal } from '@/components/ui/Modal';
import { onboardingCopy } from './onboarding.copy';

type OnboardingWelcomeProps = {
  isOpen: boolean;
  onAddExpense: () => void;
  onCreateGroup: () => void;
  onDismiss: () => void;
};

export const OnboardingWelcome = ({ isOpen, onAddExpense, onCreateGroup, onDismiss }: OnboardingWelcomeProps) => {
  return (
    <Modal isOpen={isOpen} onClose={onDismiss} title={onboardingCopy.title} size="sm">
      <div className="onboarding">
        <p className="onboarding__description">{onboardingCopy.description}</p>

        <ul className="onboarding__steps">
          {onboardingCopy.steps.map(step => (
            <li key={step.text} className="onboarding__step">
              <span className="onboarding__step-icon" aria-hidden="true">
                {step.icon}
              </span>
              <span>{step.text}</span>
            </li>
          ))}
        </ul>

        <div className="onboarding__actions">
          <button type="button" className="button button--primary" onClick={onAddExpense}>
            {onboardingCopy.addExpenseCta}
          </button>
          <button type="button" className="button button--ghost" onClick={onCreateGroup}>
            {onboardingCopy.createGroupCta}
          </button>
          <button type="button" className="button button--link" onClick={onDismiss}>
            {onboardingCopy.skipCta}
          </button>
        </div>
      </div>
    </Modal>
  );
};
