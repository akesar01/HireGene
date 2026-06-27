import type { ResumeProfile } from "@/lib/profile";

interface ResumeDisplayProps {
  profile: ResumeProfile;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-5 shadow-card">
      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

function TagChip({ label }: { label: string }) {
  return (
    <span className="inline-block bg-surface text-muted text-xs font-medium px-2.5 py-1 rounded-md">
      {label}
    </span>
  );
}

export default function ResumeDisplay({ profile }: ResumeDisplayProps) {
  const { contact, experience, education, certifications, skills } = profile;
  const hasContact = contact.name || contact.email || contact.phone || contact.location;
  const hasSkills = skills.languages.length || skills.frameworks.length || skills.tools.length || skills.soft.length;

  return (
    <div className="space-y-4">
      {hasContact && (
        <SectionCard title="Contact">
          <div className="space-y-1.5 text-sm">
            {contact.name && <p className="font-semibold text-foreground">{contact.name}</p>}
            {contact.email && <p className="text-muted">{contact.email}</p>}
            {contact.phone && <p className="text-muted">{contact.phone}</p>}
            {contact.location && <p className="text-muted">{contact.location}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              {contact.linkedin && <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-xs">LinkedIn</a>}
              {contact.github && <a href={contact.github} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-xs">GitHub</a>}
              {contact.portfolio && <a href={contact.portfolio} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-xs">Portfolio</a>}
            </div>
          </div>
        </SectionCard>
      )}

      {experience.length > 0 && (
        <SectionCard title="Experience">
          <div className="space-y-4">
            {experience.map((exp, i) => (
              <div key={i} className="border-b border-border-light last:border-0 pb-3 last:pb-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{exp.title}</p>
                  <span className="text-xs text-muted-light shrink-0">{exp.startDate} — {exp.endDate}</span>
                </div>
                <p className="text-xs text-muted mb-2">{exp.company}</p>
                {exp.bullets.length > 0 && (
                  <ul className="space-y-1">
                    {exp.bullets.map((b, j) => (
                      <li key={j} className="text-xs text-muted leading-relaxed flex items-start gap-1.5">
                        <span className="text-muted-light shrink-0 mt-0.5">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {education.length > 0 && (
        <SectionCard title="Education">
          <div className="space-y-3">
            {education.map((edu, i) => (
              <div key={i}>
                <p className="text-sm font-semibold text-foreground">{edu.degree}</p>
                <p className="text-xs text-muted">{edu.institution}</p>
                <p className="text-xs text-muted-light">
                  {edu.graduationYear}{edu.gpa && ` · GPA: ${edu.gpa}`}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {certifications.length > 0 && (
        <SectionCard title="Certifications">
          <div className="flex flex-wrap gap-2">
            {certifications.map((cert, i) => (
              <TagChip key={i} label={cert} />
            ))}
          </div>
        </SectionCard>
      )}

      {hasSkills && (
        <SectionCard title="Skills">
          <div className="space-y-3">
            {skills.languages.length > 0 && (
              <div>
                <p className="text-xs text-muted-light mb-1.5">Languages</p>
                <div className="flex flex-wrap gap-1.5">
                  {skills.languages.map((s, i) => <TagChip key={i} label={s} />)}
                </div>
              </div>
            )}
            {skills.frameworks.length > 0 && (
              <div>
                <p className="text-xs text-muted-light mb-1.5">Frameworks</p>
                <div className="flex flex-wrap gap-1.5">
                  {skills.frameworks.map((s, i) => <TagChip key={i} label={s} />)}
                </div>
              </div>
            )}
            {skills.tools.length > 0 && (
              <div>
                <p className="text-xs text-muted-light mb-1.5">Tools</p>
                <div className="flex flex-wrap gap-1.5">
                  {skills.tools.map((s, i) => <TagChip key={i} label={s} />)}
                </div>
              </div>
            )}
            {skills.soft.length > 0 && (
              <div>
                <p className="text-xs text-muted-light mb-1.5">Soft Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {skills.soft.map((s, i) => <TagChip key={i} label={s} />)}
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
