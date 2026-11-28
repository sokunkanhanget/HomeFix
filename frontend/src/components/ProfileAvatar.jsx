import Icon from "./Icon.jsx";

// Round profile picture; falls back to a person icon when there is no photo.
export default function ProfileAvatar({ photoUrl, name, size = 36, className = "" }) {
  const style = { width: size, height: size };
  if (photoUrl) {
    return <img src={photoUrl} alt={name ? `${name}'s profile photo` : "Profile photo"} style={style} className={`rounded-full border-2 border-[#d6dfea] object-cover ${className}`} />;
  }
  return <span style={style} className={`grid place-items-center rounded-full bg-[#e7eef6] text-[#315b82] ${className}`} aria-hidden="true">
    <Icon name="user" size={Math.round(size * 0.45)} />
  </span>;
}
