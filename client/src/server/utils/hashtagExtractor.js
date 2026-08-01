const MENTION_REGEX = /@(\w{3,30})/g;
const HASHTAG_REGEX = /#(\w{2,50})/g;

function extractHashtags(text) {
  if (!text) return [];
  const matches = text.match(HASHTAG_REGEX);
  if (!matches) return [];
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
}

function extractMentions(text) {
  if (!text) return [];
  const matches = text.match(MENTION_REGEX);
  if (!matches) return [];
  return [...new Set(matches.map((mention) => mention.slice(1).toLowerCase()))];
}

module.exports = { extractHashtags, extractMentions };
