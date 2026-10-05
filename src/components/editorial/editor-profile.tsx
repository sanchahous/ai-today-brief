import { CONTACT_EMAIL, EDITOR_NAME, EDITOR_PROFILE, type Lang } from '@/lib/site';
import styles from './profile-pages.module.css';

export function EditorAvatar({ large = false }: { large?: boolean }) {
  const initials = EDITOR_NAME.split(' ')
    .map((part) => part[0])
    .join('');
  return (
    <span aria-hidden="true" className={`${styles.avatar} ${large ? styles.avatarLarge : ''}`}>
      {initials}
    </span>
  );
}

export function EditorLinks({ lang }: { lang: Lang }) {
  return (
    <ul className={styles.links}>
      {EDITOR_PROFILE.links.map((link) => (
        <li key={link.url}>
          <a href={link.url} target="_blank" rel="noopener noreferrer me">
            {link.label}
          </a>
        </li>
      ))}
      <li>
        <a href={`mailto:${CONTACT_EMAIL}`}>
          {lang === 'uk' ? 'Написати редактору' : 'Email the editor'}
        </a>
      </li>
    </ul>
  );
}
