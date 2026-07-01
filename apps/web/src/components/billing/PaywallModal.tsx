import { Modal } from '@/components/ui/Modal';
import { paywallCopy } from './paywall.copy';

type PaywallModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const PaywallModal = ({ isOpen, onClose }: PaywallModalProps) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={paywallCopy.title} size="sm">
      <div className="paywall">
        <p className="paywall__description">{paywallCopy.description}</p>

        <ul className="paywall__benefits">
          {paywallCopy.benefits.map(benefit => (
            <li key={benefit} className="paywall__benefit">
              <span className="paywall__benefit-icon" aria-hidden="true">
                ✓
              </span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        <div className="paywall__actions">
          <button type="button" className="button button--primary" disabled title={paywallCopy.upgradeNote}>
            {paywallCopy.upgradeCta}
          </button>
          <p className="paywall__note">{paywallCopy.upgradeNote}</p>
          <button type="button" className="button button--link" onClick={onClose}>
            {paywallCopy.dismissCta}
          </button>
        </div>
      </div>
    </Modal>
  );
};
