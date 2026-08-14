import { motion } from "framer-motion";

const screenTransition = {
  initial: { opacity: 0, y: 18, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.985 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
};

export function ScreenTransition({ children, className = "screen-transition" }) {
  return (
    <motion.div className={`${className} app-page-content`} {...screenTransition}>
      {children}
    </motion.div>
  );
}

export default function SinglePlayerFrame({
  children,
  className = "fullscreen-bg",
  backgroundImage,
  coinShopModal,
  dailyRewardMeterModal,
  coinRewardToastOverlay,
  xpToastOverlay,
  objectiveProgressModal,
}) {
  return (
    <div
      className={className}
      style={backgroundImage ? { backgroundImage } : undefined}
    >
      {coinShopModal}
      {dailyRewardMeterModal}
      {coinRewardToastOverlay}
      {xpToastOverlay}
      {objectiveProgressModal}
      {children}
    </div>
  );
}
