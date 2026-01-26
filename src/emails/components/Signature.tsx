import { Column, Img, Link, Row, Section, Text } from "@react-email/components";
import type * as React from "react";

export const Signature = () => {
  return (
    <Section style={signature}>
      <Row>
        <Column style={logoColumn}>
          <Img
            src="https://andy-cinquin.fr/assets/android-chrome-192x192.png"
            width="55"
            height="55"
            alt="Andy Cinquin"
            style={logo}
          />
        </Column>
        <Column style={infoColumn}>
          <Text style={name}>Andy Cinquin</Text>
          <Text style={title}>Full-Stack Freelance Developer</Text>
          <Text style={contactInfo}>
            +33 6 21 58 26 84 | Haute-Goulaine, France
          </Text>
          <Text style={contactInfo}>
            <Link href="mailto:contact@andy-cinquin.fr" style={linkGray}>
              contact@andy-cinquin.fr
            </Link>
            {" | "}
            <Link href="https://andy-cinquin.com/" style={linkGray}>
              andy-cinquin.com
            </Link>
          </Text>
          <Text style={contactInfo}>
            <Link href="https://bento.me/andy-cinquin" style={linkGray}>
              Other Projects: https://bento.me/andy-cinquin
            </Link>
          </Text>

          {/* Social Icons */}
          <Section style={socialRow}>
            <Link href="https://github.com/CinquinAndy" style={socialLink}>
              <Img
                src="https://cdn.gifo.wisestamp.com/s/gh/4183c4/48/0/background.png"
                width="24"
                height="24"
                alt="GitHub"
              />
            </Link>
            <Link href="https://instagram.com/cinquin.andy" style={socialLink}>
              <Img
                src="https://cdn.gifo.wisestamp.com/s/inst/E4405F/48/0/background.png"
                width="24"
                height="24"
                alt="Instagram"
              />
            </Link>
            <Link
              href="https://linkedin.com/in/andy-cinquin/"
              style={socialLink}
            >
              <Img
                src="https://cdn.gifo.wisestamp.com/s/ld/0077b5/48/0/background.png"
                width="24"
                height="24"
                alt="LinkedIn"
              />
            </Link>
          </Section>
        </Column>
      </Row>
    </Section>
  );
};

// Styles
const signature: React.CSSProperties = {
  padding: "0",
};

const logoColumn: React.CSSProperties = {
  width: "65px",
  paddingRight: "14px",
  verticalAlign: "top",
};

const logo: React.CSSProperties = {
  borderRadius: "0",
};

const infoColumn: React.CSSProperties = {
  paddingLeft: "14px",
  borderLeft: "1px solid #bdbdbd",
  verticalAlign: "top",
};

const name: React.CSSProperties = {
  fontSize: "12pt",
  fontWeight: "bold",
  color: "#646464",
  margin: "0 0 4px 0",
};

const title: React.CSSProperties = {
  fontSize: "10pt",
  fontWeight: "bold",
  color: "#646464",
  margin: "0 0 10px 0",
};

const contactInfo: React.CSSProperties = {
  fontSize: "8.5pt",
  color: "#3b3838",
  margin: "0 0 5px 0",
  lineHeight: "1.2",
};

const linkGray: React.CSSProperties = {
  color: "#3b3838",
  textDecoration: "none",
  fontSize: "8.5pt",
};

const socialRow: React.CSSProperties = {
  marginTop: "14px",
};

const socialLink: React.CSSProperties = {
  display: "inline-block",
  marginRight: "6px",
};

export default Signature;
