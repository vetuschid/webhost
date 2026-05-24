# Output Schema

Return a JSON object that matches this schema exactly. Do not include extra fields.

## Output Schema

```json
{
  "type": "object",
  "properties": {
    "qualified": {
      "type": "boolean",
      "description": "True if the lead matches the ICP and has no disqualifiers."
    },
    "score": {
      "type": "integer",
      "minimum": 1,
      "maximum": 10,
      "description": "Confidence-weighted fit score, 10 = perfect."
    },
    "vertical_fit": {
      "type": "string",
      "enum": ["healthcare", "adjacent_health", "non_healthcare"],
      "description": "Does the lead's company sell into healthcare?"
    },
    "reasoning": {
      "type": "string",
      "description": "Two sentences explaining the verdict."
    }
  },
  "required": ["qualified", "score", "vertical_fit", "reasoning"],
  "additionalProperties": false
}
```
