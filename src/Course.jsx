import React from 'react'

function Course({course}) {
const {id,tittle, desciption,price,link,image}=course;
    return (

    <div className='course'>
      <div>
        <img src={image} width={210}height={110}/>
        <h4 className='course-title'>{tittle}</h4>
        <h6 className='course-des'>{desciption}</h6>
      <h3 className='corse-price'>Kurs Pul:{price} $</h3>
    <button>Gosulmak Ucin</button> <div  className='course-link'><a href="" style={{textDecoration :' none', fontSize:20}}><h6>{link}</h6></a>
    
      </div>
    
      </div>
    
    </div>
  )
}

export default Course
