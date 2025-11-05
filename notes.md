# Make Tunes


todo:
- breakdown and analyse collaboration service and add tests
    v changed the testing framework from jest to vitest
    v updatesd audio engine tests to vitest and fxed mock audio context
    v write tests for collaboraiton service
    v break down the collaboration file
- do the same with the 'store' file --> nah fuck that, do that later
    - plan refactor
    - write tests
    - break down to separate files


- implement the moderation system. should mods be able to adjust eq? who desides? both settings saved?
- run an automated git test?

~~~~~~~~~~~~
Collab after closing:
After the collab is resolved, the winning submissions is saved. 
The user is able to add a new mix which will represent result of merging the winning submission with the original material ??
when the past stage is played back from the project history component:

~UX~
if there is no new mix uploaded and no following collabs original backing track and winning submissions are played.
if theres a mix uploaded that mix will be played and optionally original track +
 submission + winning submission can be played?

 v quick fix: for now just play submission and backing in respective players
~~~~~~~~~~

## administration system
v - only allow admins to admin paths 
v - add report submission (offensive etc) + view to review reports

## the fucking audio delay
~~~~
## The Real Solution to the audio sync problem:
deactivate play buttons untill the item link not fetched!!!!
WOW, pragmatic innit :D
£££ OR ||
check if generating the links server side isnt a better idea ( if thats possible then its clearly more efficien )
§§§§
the real real solution: the problem was never there lol
non invasively test storing the token urls in the database
@@@@@@@




Master plan:
- minimal fixes to the exsisting UX:
        add collabListProgressionBar to display current collabs state in my collabs
        clear up on hover colors;
        make sure the mental path to goal is always clear and that all the affordables have their signifiers
- organise (and urderstand lol) the styling
- get feedback from the ux ppl
- implement improvements
- release a beta version



@@ save plenty lines - dont repeat selected tab structure in 'my projects' component



IDEAS:
create a rag chatbot that will answer the questions about the system. 
improve accessibility! ( blind ppl are often very good at music )



Todo list before showing the system to the ux people