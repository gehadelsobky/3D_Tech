import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '../context/ProductContext';
import { useGiftSettings } from '../context/GiftSettingsContext';
import { useCategories } from '../context/CategoryContext';
import ProductCard from '../components/ProductCard';
import SEO from '../components/SEO';

const steps = [
  { key: 'occasion', label: 'Purpose', question: 'What is the purpose?' },
  { key: 'budget', label: 'Budget', question: 'What is your budget per unit?' },
  { key: 'audience', label: 'Audience', question: 'Who is your target audience?' },
  { key: 'quantity', label: 'Quantity', question: 'How many units do you need?' },
  { key: 'delivery', label: 'Timeline', question: 'When do you need them?' },
];

function parseQuantityMax(quantity) {
  // Parse "50 - 100 units" → 100, "500+ units" → 999999, fallback 999999
  const rangeMatch = quantity.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) return parseInt(rangeMatch[2], 10);
  const plusMatch = quantity.match(/(\d+)\+/);
  if (plusMatch) return 999999;
  return 999999;
}

function getRecommendations(answers, products, settings) {
  const { budget, audience, quantity, delivery, occasion } = answers;

  // Build maps dynamically from settings
  const budgetRange = settings.budgetRanges?.find((b) => b.label === budget);
  const maxBudget = budgetRange ? budgetRange.max : Infinity;
  const minBudget = budgetRange ? budgetRange.min : 0;

  const deliveryTf = settings.deliveryTimeframes?.find((d) => d.label === delivery);
  const maxDays = deliveryTf ? deliveryTf.days : Infinity;

  const preferredCats = settings.audienceCategoryMap?.[audience] || [];
  const preferredTags = settings.giftTagMap?.[occasion] || [];
  const maxQty = parseQuantityMax(quantity);

  const scored = products.map((p) => {
    let score = 0;
    const matchInfo = { budgetFit: false, deliveryFit: false, audienceMatch: false, tagMatches: 0, qtyFit: false };

    // Budget fit
    if (p.priceMin !== undefined) {
      if (p.priceMin >= minBudget && p.priceMin <= maxBudget) {
        score += 3;
        matchInfo.budgetFit = true;
      } else if (p.priceMax <= maxBudget) {
        score += 1;
        matchInfo.budgetFit = true;
      }
    }

    // Delivery fit
    if (p.leadDays !== undefined && p.leadDays <= maxDays) {
      score += 2;
      matchInfo.deliveryFit = true;
    }

    // Audience category match
    if (preferredCats.includes(p.category)) {
      score += 2;
      matchInfo.audienceMatch = true;
    }

    // Gift type tag match
    if (p.tags) {
      const tagCount = p.tags.filter((t) => preferredTags.includes(t)).length;
      score += tagCount;
      matchInfo.tagMatches = tagCount;
    }

    // Quantity fit (dynamic parsing)
    if (p.moq <= maxQty) {
      score += 1;
      matchInfo.qtyFit = true;
    }

    return { ...p, _score: score, _matchInfo: matchInfo };
  });

  scored.sort((a, b) => b._score - a._score);

  return scored.slice(0, 4).map(({ _score, ...p }) => p);
}

export default function GiftFinder() {
  const { products, loading: productsLoading } = useProducts();
  const { settings, loading: settingsLoading } = useGiftSettings();
  const { categories } = useCategories();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  const loading = productsLoading || settingsLoading;

  // Build step options from settings
  const stepOptions = useMemo(() => {
    if (!settings) return {};
    return {
      occasion: settings.giftTypes || [],
      budget: (settings.budgetRanges || []).map((b) => b.label),
      audience: settings.audienceTypes || [],
      quantity: settings.quantityRanges || [],
      delivery: (settings.deliveryTimeframes || []).map((d) => d.label),
    };
  }, [settings]);

  const currentStep = steps[step];

  const selectOption = (value) => {
    const updated = { ...answers, [currentStep.key]: value };
    setAnswers(updated);

    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      setShowResults(true);
    }
  };

  const reset = () => {
    setStep(0);
    setAnswers({});
    setShowResults(false);
  };

  const recommended = showResults && settings ? getRecommendations(answers, products, settings) : [];
  const recommendedCategories = showResults
    ? [...new Set(recommended.map((p) => p.category))].map((id) => categories.find((c) => c.id === id)).filter(Boolean)
    : [];

  if (loading) {
    return (
      <main className="bg-surface min-h-screen flex items-center justify-center">
        <div className="text-text-muted">Loading...</div>
      </main>
    );
  }

  return (
    <main className="bg-surface min-h-screen">
      <SEO
        title="Gift Finder"
        description="Find the perfect corporate gift with our interactive Gift Finder. Filter by occasion, budget, audience, and quantity to discover ideal promotional products."
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-text mb-3">Gift Finder</h1>
          <p className="text-text-muted">Answer a few questions and we'll recommend the best products for your needs.</p>
        </div>

        {!showResults ? (
          <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8">
            {/* Progress */}
            <div className="flex gap-1.5 mb-8">
              {steps.map((s, i) => (
                <div
                  key={s.key}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i <= step ? 'bg-primary' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>

            <div className="text-sm text-text-muted mb-2">
              Step {step + 1} of {steps.length}
            </div>
            <h2 className="text-xl font-semibold text-text mb-6">
              {currentStep.question}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(stepOptions[currentStep.key] || []).map((option) => (
                <button
                  key={option}
                  onClick={() => selectOption(option)}
                  className="px-4 py-3 bg-surface border border-gray-200 rounded-lg text-sm font-medium text-text hover:border-primary hover:bg-red-50 transition-colors cursor-pointer text-left"
                >
                  {option}
                </button>
              ))}
            </div>

            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="mt-6 text-sm text-text-muted hover:text-text cursor-pointer bg-transparent border-none"
              >
                &larr; Back
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Summary */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 mb-8">
              <h3 className="font-semibold text-text mb-4">Your Selections</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {steps.map((s) => (
                  <div key={s.key}>
                    <div className="text-xs text-text-muted mb-1">{s.label}</div>
                    <div className="text-sm font-medium text-text">{answers[s.key]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended Categories */}
            {recommendedCategories.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-text mb-3">Recommended Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {recommendedCategories.map((cat) => (
                    <Link
                      key={cat.id}
                      to={`/products?cat=${cat.id}`}
                      className="px-3 py-1.5 bg-red-50 text-primary text-sm font-medium rounded-full no-underline hover:bg-red-100 transition-colors"
                    >
                      {cat.icon} {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Products */}
            <h3 className="font-semibold text-text mb-4">Recommended Products</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              {recommended.map((product) => (
                <ProductCard key={product.id} product={product} matchInfo={product._matchInfo} />
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={reset}
                className="px-6 py-2.5 bg-white border border-gray-200 text-text-muted font-medium rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                Start Over
              </button>
              <Link
                to={`/contact?giftType=${encodeURIComponent(answers.occasion || '')}`}
                className="px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors no-underline text-center"
              >
                Request a Quote
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
