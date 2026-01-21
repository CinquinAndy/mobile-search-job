import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import { Signature } from "./components/Signature";

interface GeneralTemplateProps {
  content: string;
}

export const GeneralTemplate = ({ content }: GeneralTemplateProps) => {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          {/* Email Content */}
          <Section style={contentContainer}>
            {content.split("\n").map((line, index) => (
              <Text key={index} style={paragraph}>
                {line}
              </Text>
            ))}
          </Section>

          <Hr style={hr} />

          {/* Signature */}
          <Signature />
        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main: React.CSSProperties = {
  backgroundColor: "#ffffff",
  fontFamily:
    'Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container: React.CSSProperties = {
  margin: "0 auto",
  padding: "20px",
  maxWidth: "600px",
};

const contentContainer: React.CSSProperties = {
  padding: "0",
};

const paragraph: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "1.6",
  color: "#000000",
  marginBottom: "16px",
};

const hr: React.CSSProperties = {
  borderTop: "1px solid #bdbdbd",
  margin: "20px 0",
};

export default GeneralTemplate;
