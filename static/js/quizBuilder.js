// static/js/quizBuilder.js
// This file is for admin_create_quiz.html and admin_edit_quiz.html

function initializeQuizBuilder(mode, initialData = {}, quizId = null) {
    const questionsContainer = document.getElementById('questions-container');
    const addQuestionBtn = document.getElementById('add-question-btn');
    const saveQuizBtn = document.getElementById('save-quiz-btn');

    const createOptionInput = (option = { text: '', is_correct: false }, qIndex) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option-input-group';
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `correct_option_${qIndex}`;
        radio.checked = option.is_correct;
        
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.placeholder = 'Option text';
        // FIXED: Safely handle text values. Only parse if text exists (for edit mode).
        textInput.value = option.text ? JSON.parse(option.text) : '';
        
        const removeOptionBtn = document.createElement('button');
        removeOptionBtn.innerText = '−';
        removeOptionBtn.className = 'btn btn-danger';
        removeOptionBtn.onclick = () => optionDiv.remove();
        
        optionDiv.appendChild(radio);
        optionDiv.appendChild(textInput);
        optionDiv.appendChild(removeOptionBtn);
        return optionDiv;
    };

    const createQuestionBlock = (question = { text: '', options: [] }, qIndex) => {
        const questionBlock = document.createElement('div');
        questionBlock.className = 'question-block';
        questionBlock.dataset.qIndex = qIndex;
        
        const questionText = document.createElement('textarea');
        questionText.placeholder = `Question ${qIndex + 1} Text`;
        questionText.rows = 2;
        // FIXED: Safely handle text values. Only parse if text exists (for edit mode).
        questionText.value = question.text ? JSON.parse(question.text) : '';
        
        const removeQuestionBtn = document.createElement('button');
        removeQuestionBtn.innerText = 'Remove Question';
        removeQuestionBtn.className = 'btn btn-danger';
        removeQuestionBtn.style.float = 'right';
        removeQuestionBtn.onclick = () => questionBlock.remove();
        
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'options-container';
        
        (question.options.length > 0 ? question.options : [{}, {}]).forEach(opt => {
            optionsDiv.appendChild(createOptionInput(opt, qIndex));
        });
        
        const addOptionBtn = document.createElement('button');
        addOptionBtn.innerText = 'Add Option';
        addOptionBtn.className = 'btn btn-secondary';
        addOptionBtn.onclick = () => optionsDiv.appendChild(createOptionInput(undefined, qIndex));
        
        questionBlock.appendChild(removeQuestionBtn);
        questionBlock.appendChild(questionText);
        questionBlock.appendChild(optionsDiv);
        questionBlock.appendChild(addOptionBtn);
        return questionBlock;
    };

    addQuestionBtn.addEventListener('click', () => {
        const qIndex = questionsContainer.children.length;
        questionsContainer.appendChild(createQuestionBlock(undefined, qIndex));
    });

    saveQuizBtn.addEventListener('click', async () => {
        const quizData = {
            title: document.getElementById('quiz-title').value,
            description: document.getElementById('quiz-description').value,
            questions: []
        };
        
        document.querySelectorAll('.question-block').forEach(qBlock => {
            const questionText = qBlock.querySelector('textarea').value;
            const options = [];
            qBlock.querySelectorAll('.option-input-group').forEach(optGroup => {
                options.push({
                    text: optGroup.querySelector('input[type="text"]').value,
                    is_correct: optGroup.querySelector('input[type="radio"]').checked
                });
            });
            quizData.questions.push({ text: questionText, options: options });
        });

        // Basic validation
        if (!quizData.title) {
            alert('Quiz title cannot be empty.');
            return;
        }
        if (quizData.questions.length === 0) {
            alert('A quiz must have at least one question.');
            return;
        }


        const url = mode === 'create' ? '/admin/create' : `/admin/edit/${quizId}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(quizData)
        });
        
        const result = await response.json();
        alert(result.message);
        if (response.ok) {
            window.location.href = '/dashboard';
        }
    });

    // Initialize with existing data if in edit mode
    if (mode === 'edit' && initialData.questions) {
        initialData.questions.forEach((q, index) => {
            questionsContainer.appendChild(createQuestionBlock(q, index));
        });
    } else {
        // Start with one empty question for a new quiz
        addQuestionBtn.click();
    }
}