import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import axios from 'axios';
import { OpenAI } from 'ai/openai';

export function EmptyScreen({
  submitMessage,
  className
}: {
  submitMessage: (message: string) => void,
  className?: string
}) {
  const [newsData, setNewsData] = useState<any[]>([]);
  const [error, setError] = useState<null | string>(null);
  const openai = new OpenAI({
    apiKey: process.env.REACT_APP_OPENAI_API_KEY,
  });

  useEffect(() => {
    axios
      .get('https://newsdata.io/api/1/news', {
        params: {
          apikey: process.env.REACT_APP_NEWSDATA_API_KEY,
          language: 'en',
        },
      })
      .then(async (response) => {
        const newsArticles = response.data;
        const summarisedNews = await Promise.all(
          newsArticles.map(async (article) => {
            const gptResponse = await openai.complete({
              engine: 'gpt-3.5-turbo',
              prompt: article.description,
              max_tokens: 60,
            });
            return {
              title: article.title,
              link: article.link,
              description: gptResponse.choices[0].text.strip(),
            };
          })
        );
        setNewsData(summarisedNews);
      })
      .catch((error) => {
        setError(error.toString());
      });
  }, []);

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (newsData.length === 0) {
    return <div>Loading...</div>;
  }

  return (
    <div className={`mx-auto w-full transition-all ${className}`}>
      <div className="bg-background p-2">
        <div className="mt-4 flex flex-col items-start space-y-2 mb-4">
          {newsData.map((news, index) => (
            <Button
              key={index}
              variant="link"
              className="h-auto p-0 text-base"
              name={news.description}
              onClick={async () => {
                submitMessage(news.description);
              }}
            >
              <ArrowRight size={16} className="mr-2 text-muted-foreground" />
              {news.title}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
