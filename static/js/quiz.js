document.addEventListener('DOMContentLoaded', () => {
    const quizContainer = document.getElementById('quiz-container');
    // If the quiz container isn't on the page, do nothing.
    if (!quizContainer) return;

    const quizId = quizContainer.dataset.quizId;
    const questionText = document.getElementById('question-text');
    const optionsList = document.getElementById('options-list');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');
    const resultContainer = document.getElementById('result-container');
    const scoreEl = document.getElementById('score');

    let currentQuestionIndex = 0;
    let questions = [];
    let userAnswers = {};

    /**
     * Fetches quiz data from the API and starts the quiz.
     */
    async function fetchQuizData() {
        const response = await fetch(`/api/quiz/${quizId}`);
        const data = await response.json();
        questions = data.questions;
        renderQuestion();
    }

    /**
     * Displays the current question and its options.
     */
    function renderQuestion() {
        const question = questions[currentQuestionIndex];
        questionText.innerText = `${currentQuestionIndex + 1}. ${question.text}`;
        optionsList.innerHTML = '';

        // Create a radio button for each option
        question.options.forEach(option => {
            const label = document.createElement('label');
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'option';
            radio.value = option.id;
            radio.dataset.questionId = question.id;

            // If an answer was previously selected for this question, check the box
            if (userAnswers[question.id] == option.id) {
                radio.checked = true;
            }
            
            label.appendChild(radio);
            label.append(` ${option.text}`);
            optionsList.appendChild(label);
        });

        updateNavButtons();
    }

    /**
     * Shows or hides navigation buttons based on the current question.
     */
    function updateNavButtons() {
        prevBtn.style.display = currentQuestionIndex === 0 ? 'none' : 'inline-block';
        nextBtn.style.display = currentQuestionIndex === questions.length - 1 ? 'none' : 'inline-block';
        submitBtn.style.display = currentQuestionIndex === questions.length - 1 ? 'inline-block' : 'none';
    }

    /**
     * Saves the currently selected answer to the userAnswers object.
     */
    function saveAnswer() {
        const selectedOption = optionsList.querySelector('input[name="option"]:checked');
        if (selectedOption) {
            const questionId = selectedOption.dataset.questionId;
            userAnswers[questionId] = selectedOption.value;
        }
    }

    // Event listener for the "Next" button
    nextBtn.addEventListener('click', () => {
        saveAnswer();
        if (currentQuestionIndex < questions.length - 1) {
            currentQuestionIndex++;
            renderQuestion();
        }
    });

    // Event listener for the "Previous" button
    prevBtn.addEventListener('click', () => {
        saveAnswer();
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            renderQuestion();
        }
    });

    // Event listener for the "Submit" button
    submitBtn.addEventListener('click', async () => {
        saveAnswer();

        // Warn user if not all questions are answered
        if (Object.keys(userAnswers).length !== questions.length) {
            if (!confirm('You have not answered all questions. Are you sure you want to submit?')) {
                return;
            }
        }

        // Send answers to the server
        const response = await fetch(`/api/submit/${quizId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ answers: userAnswers })
        });
        const result = await response.json();
        
        // Display the final score
        quizContainer.style.display = 'none';
        resultContainer.style.display = 'block';
        scoreEl.innerText = `${result.score} / ${result.total}`;
    });

    // Start the quiz by fetching data
    fetchQuizData();
});